from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Peer, ServerNode, User
from app.schemas import ServerNodeCreate, ServerNodeResponse, ServerNodeUpdate
from app.security import get_current_user, require_admin
from app.services.wireguard import validate_wireguard_key

router = APIRouter(prefix="/api/v1/servers", tags=["servers"])


def _to_server_response(server: ServerNode, active_peers: int) -> ServerNodeResponse:
    load_percent = min(100, round((active_peers / max(server.max_peers, 1)) * 100))
    return ServerNodeResponse(
        id=server.id,
        slug=server.slug,
        name=server.name,
        city=server.city,
        region_code=server.region_code,
        provider=server.provider,
        endpoint_host=server.endpoint_host,
        listen_port=server.listen_port,
        public_key=server.public_key,
        subnet_cidr=server.subnet_cidr,
        dns_servers=server.dns_servers,
        mtu=server.mtu,
        max_peers=server.max_peers,
        active_peers=active_peers,
        load_percent=load_percent,
        latency_ms_estimate=server.latency_ms_estimate,
        is_active=server.is_active,
    )


@router.get("", response_model=list[ServerNodeResponse])
def list_servers(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
) -> list[ServerNodeResponse]:
    servers = db.scalars(
        select(ServerNode)
        .where(ServerNode.is_active.is_(True))
        .order_by(ServerNode.latency_ms_estimate.asc(), ServerNode.id.asc())
    ).all()

    counts = dict(
        db.execute(
            select(Peer.server_id, func.count(Peer.id))
            .where(Peer.is_active.is_(True))
            .group_by(Peer.server_id)
        ).all()
    )
    return [_to_server_response(s, counts.get(s.id, 0)) for s in servers]


@router.post("", response_model=ServerNodeResponse, status_code=status.HTTP_201_CREATED)
def create_server(
    payload: ServerNodeCreate,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> ServerNodeResponse:
    if db.scalar(select(ServerNode).where(ServerNode.slug == payload.slug)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Server with slug '{payload.slug}' already exists",
        )
    try:
        validated_key = validate_wireguard_key(payload.public_key)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    server = ServerNode(
        slug=payload.slug,
        name=payload.name,
        city=payload.city,
        region_code=payload.region_code,
        provider=payload.provider,
        endpoint_host=payload.endpoint_host,
        listen_port=payload.listen_port,
        public_key=validated_key,
        subnet_cidr=payload.subnet_cidr,
        dns_servers=payload.dns_servers,
        mtu=payload.mtu,
        max_peers=payload.max_peers,
        latency_ms_estimate=payload.latency_ms_estimate,
        is_active=True,
    )
    db.add(server)
    db.commit()
    db.refresh(server)
    return _to_server_response(server, 0)


@router.get("/ping")
def ping_control_plane() -> dict[str, object]:
    return {"ok": True, "server_time_utc": datetime.now(timezone.utc).isoformat()}


@router.patch("/{server_id}", response_model=ServerNodeResponse)
def update_server(
    server_id: int,
    payload: ServerNodeUpdate,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> ServerNodeResponse:
    server = db.get(ServerNode, server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server node not found")

    if payload.public_key is not None:
        try:
            server.public_key = validate_wireguard_key(payload.public_key)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    for field in ("name", "endpoint_host", "listen_port", "dns_servers", "mtu", "latency_ms_estimate", "is_active"):
        val = getattr(payload, field)
        if val is not None:
            setattr(server, field, val)

    db.commit()
    db.refresh(server)
    active_count = db.scalar(
        select(func.count(Peer.id)).where(Peer.server_id == server.id, Peer.is_active.is_(True))
    ) or 0
    return _to_server_response(server, active_count)
