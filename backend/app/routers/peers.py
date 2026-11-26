from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import Settings, get_settings
from app.database import get_db
from app.models import ConnectionAuditLog, Peer, ServerNode, User
from app.schemas import (
    PeerConfigResponse,
    PeerCreateRequest,
    PeerProvisionResponse,
    PeerResponse,
    TelemetryEventRequest,
    TelemetryEventResponse,
)
from app.security import get_current_user
from app.services.ip_pool import IPPoolExhaustedError, allocate_next_ip
from app.services.qr import render_qr_png, render_qr_svg
from app.services.wireguard import (
    WireGuardDriver,
    build_wireguard_driver,
    generate_keypair,
    generate_preshared_key,
    render_wg_quick_config,
    validate_wireguard_key,
)

router = APIRouter(prefix="/api/v1/peers", tags=["peers"])


def get_wg_driver(settings: Annotated[Settings, Depends(get_settings)]) -> WireGuardDriver:
    return build_wireguard_driver(settings.WG_DRIVER, settings.WG_INTERFACE)


def _peer_to_response(peer: Peer) -> PeerResponse:
    return PeerResponse(
        id=peer.id,
        user_id=peer.user_id,
        server_id=peer.server_id,
        server_slug=peer.server.slug,
        server_name=peer.server.name,
        server_city=peer.server.city,
        device_name=peer.device_name,
        public_key=peer.public_key,
        assigned_ip=peer.assigned_ip,
        endpoint=f"{peer.server.endpoint_host}:{peer.server.listen_port}",
        is_active=peer.is_active,
        created_at=peer.created_at,
        revoked_at=peer.revoked_at,
        has_server_private_key=peer.private_key is not None,
    )


def _render_peer_config(peer: Peer, settings: Settings) -> str:
    return render_wg_quick_config(
        client_private_key=peer.private_key,
        assigned_ip=peer.assigned_ip,
        dns_servers=peer.server.dns_servers or settings.WG_DEFAULT_DNS,
        mtu=peer.server.mtu or settings.WG_DEFAULT_MTU,
        server_public_key=peer.server.public_key,
        preshared_key=peer.preshared_key,
        endpoint_host=peer.server.endpoint_host,
        listen_port=peer.server.listen_port,
        persistent_keepalive=settings.WG_PERSISTENT_KEEPALIVE,
    )


def _get_owned_peer(peer_id: int, user: User, db: Session) -> Peer:
    peer = db.scalar(
        select(Peer).options(joinedload(Peer.server)).where(Peer.id == peer_id)
    )
    if peer is None or (peer.user_id != user.id and not user.is_admin):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Peer not found")
    return peer


def _record_audit_if_enabled(
    *,
    db: Session,
    settings: Settings,
    peer: Peer,
    event_type: str,
    source_ip: str | None,
    note: str | None = None,
) -> datetime | None:
    if settings.COMPLIANCE_MODE != "cert_in_audit":
        return None
    now = datetime.now(timezone.utc)
    retention_until = now + timedelta(days=settings.CERT_IN_RETENTION_DAYS)
    db.add(
        ConnectionAuditLog(
            user_id=peer.user_id,
            peer_id=peer.id,
            server_id=peer.server_id,
            event_type=event_type,
            assigned_vpn_ip=peer.assigned_ip,
            source_ip=source_ip,
            metadata_note=note,
            recorded_at=now,
            retention_until=retention_until,
        )
    )
    return retention_until


@router.get("", response_model=list[PeerResponse])
def list_peers(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    include_revoked: bool = Query(default=False),
) -> list[PeerResponse]:
    stmt = (
        select(Peer)
        .options(joinedload(Peer.server))
        .where(Peer.user_id == current_user.id)
        .order_by(Peer.created_at.desc(), Peer.id.desc())
    )
    if not include_revoked:
        stmt = stmt.where(Peer.is_active.is_(True))
    peers = db.scalars(stmt).all()
    return [_peer_to_response(p) for p in peers]


@router.post("", response_model=PeerProvisionResponse, status_code=status.HTTP_201_CREATED)
def provision_peer(
    payload: PeerCreateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    driver: Annotated[WireGuardDriver, Depends(get_wg_driver)],
) -> PeerProvisionResponse:
    server = db.get(ServerNode, payload.server_id)
    if server is None or not server.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VPN server not found")

    active_peers = db.scalars(
        select(Peer).where(Peer.server_id == server.id, Peer.is_active.is_(True))
    ).all()
    if len(active_peers) >= server.max_peers:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Selected server has reached maximum peer capacity",
        )

    # All currently reserved/assigned IPs (only active peers hold an IP; revoked IPs are recycled)
    used_ips = [p.assigned_ip for p in active_peers]
    # Remove any inactive peers occupying an IP we are about to recycle to satisfy DB unique constraint.
    try:
        assigned_ip = allocate_next_ip(server.subnet_cidr, used_ips)
    except IPPoolExhaustedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    stale_revoked = db.scalars(
        select(Peer).where(
            Peer.server_id == server.id,
            Peer.assigned_ip == assigned_ip,
            Peer.is_active.is_(False),
        )
    ).all()
    for old_peer in stale_revoked:
        db.delete(old_peer)
    db.flush()

    if payload.client_public_key:
        try:
            public_key = validate_wireguard_key(payload.client_public_key)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
        private_key: str | None = None
    else:
        keypair = generate_keypair()
        public_key = keypair.public_key
        private_key = keypair.private_key

    duplicate_pub = db.scalar(
        select(Peer).where(Peer.server_id == server.id, Peer.public_key == public_key)
    )
    if duplicate_pub is not None:
        if duplicate_pub.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This WireGuard public key is already active on the selected server",
            )
        db.delete(duplicate_pub)
        db.flush()

    preshared_key = generate_preshared_key()
    peer = Peer(
        user_id=current_user.id,
        server_id=server.id,
        device_name=payload.device_name.strip(),
        public_key=public_key,
        private_key=private_key,
        preshared_key=preshared_key,
        assigned_ip=assigned_ip,
        is_active=True,
    )
    db.add(peer)
    db.flush()

    client_ip = request.client.host if request.client else None
    _record_audit_if_enabled(
        db=db,
        settings=settings,
        peer=peer,
        event_type="provision",
        source_ip=client_ip,
        note=f"device={peer.device_name}",
    )

    driver.add_peer(public_key=public_key, preshared_key=preshared_key, assigned_ip=assigned_ip)
    db.commit()
    db.refresh(peer)
    peer.server = server

    config_text = _render_peer_config(peer, settings)
    return PeerProvisionResponse(
        peer=_peer_to_response(peer),
        client_private_key=private_key,
        preshared_key=preshared_key,
        wg_quick_config=config_text,
    )


@router.get("/{peer_id}/config", response_model=PeerConfigResponse)
def get_peer_config(
    peer_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> PeerConfigResponse:
    peer = _get_owned_peer(peer_id, current_user, db)
    if not peer.is_active:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Peer has been revoked")

    return PeerConfigResponse(
        peer_id=peer.id,
        assigned_ip=peer.assigned_ip,
        endpoint=f"{peer.server.endpoint_host}:{peer.server.listen_port}",
        wg_quick_config=_render_peer_config(peer, settings),
        key_custody="server_generated" if peer.private_key else "client_managed",
    )


@router.get("/{peer_id}/config/raw", response_class=PlainTextResponse)
def download_peer_config_raw(
    peer_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> PlainTextResponse:
    peer = _get_owned_peer(peer_id, current_user, db)
    if not peer.is_active:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Peer has been revoked")
    headers = {"Content-Disposition": f'attachment; filename="{peer.server.slug}-{peer.id}.conf"'}
    return PlainTextResponse(content=_render_peer_config(peer, settings), headers=headers)


@router.get("/{peer_id}/qr")
def get_peer_qr(
    peer_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    fmt: str = Query(default="png", pattern="^(png|svg)$"),
) -> Response:
    peer = _get_owned_peer(peer_id, current_user, db)
    if not peer.is_active:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Peer has been revoked")
    config_text = _render_peer_config(peer, settings)
    if fmt == "svg":
        return Response(content=render_qr_svg(config_text), media_type="image/svg+xml")
    return Response(content=render_qr_png(config_text), media_type="image/png")


@router.post("/{peer_id}/telemetry", response_model=TelemetryEventResponse)
def record_telemetry_event(
    peer_id: int,
    payload: TelemetryEventRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> TelemetryEventResponse:
    peer = _get_owned_peer(peer_id, current_user, db)
    if not peer.is_active:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Peer has been revoked")

    client_ip = request.client.host if request.client else None
    retention_until = _record_audit_if_enabled(
        db=db,
        settings=settings,
        peer=peer,
        event_type=payload.event_type,
        source_ip=client_ip,
        note=payload.note,
    )
    if retention_until is not None:
        db.commit()
    return TelemetryEventResponse(
        recorded=retention_until is not None,
        compliance_mode=settings.COMPLIANCE_MODE,
        retention_until=retention_until,
    )


@router.delete("/{peer_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_peer(
    peer_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    driver: Annotated[WireGuardDriver, Depends(get_wg_driver)],
) -> None:
    peer = _get_owned_peer(peer_id, current_user, db)
    if not peer.is_active:
        return
    peer.is_active = False
    peer.revoked_at = datetime.now(timezone.utc)
    driver.remove_peer(peer.public_key)

    client_ip = request.client.host if request.client else None
    _record_audit_if_enabled(
        db=db,
        settings=settings,
        peer=peer,
        event_type="revoke",
        source_ip=client_ip,
        note="peer revoked by user",
    )
    db.commit()
