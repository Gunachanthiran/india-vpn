from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    peers: Mapped[list["Peer"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class ServerNode(Base):
    __tablename__ = "server_nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    city: Mapped[str] = mapped_column(String(64), nullable=False)
    region_code: Mapped[str] = mapped_column(String(64), nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    endpoint_host: Mapped[str] = mapped_column(String(255), nullable=False)
    listen_port: Mapped[int] = mapped_column(Integer, default=51820, nullable=False)
    public_key: Mapped[str] = mapped_column(String(64), nullable=False)
    subnet_cidr: Mapped[str] = mapped_column(String(32), default="10.8.0.0/24", nullable=False)
    dns_servers: Mapped[str] = mapped_column(String(120), default="1.1.1.1,9.9.9.9", nullable=False)
    mtu: Mapped[int] = mapped_column(Integer, default=1420, nullable=False)
    max_peers: Mapped[int] = mapped_column(Integer, default=250, nullable=False)
    latency_ms_estimate: Mapped[int] = mapped_column(Integer, default=18, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    peers: Mapped[list["Peer"]] = relationship(back_populates="server", cascade="all, delete-orphan")


class Peer(Base):
    __tablename__ = "peers"
    __table_args__ = (
        UniqueConstraint("server_id", "assigned_ip", name="uq_server_assigned_ip"),
        UniqueConstraint("server_id", "public_key", name="uq_server_public_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    server_id: Mapped[int] = mapped_column(ForeignKey("server_nodes.id", ondelete="CASCADE"), index=True, nullable=False)
    device_name: Mapped[str] = mapped_column(String(100), nullable=False)
    public_key: Mapped[str] = mapped_column(String(64), nullable=False)
    # Populated only when server generates the keypair; NULL when client supplies its own public key.
    private_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    preshared_key: Mapped[str] = mapped_column(String(64), nullable=False)
    assigned_ip: Mapped[str] = mapped_column(String(32), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="peers")
    server: Mapped["ServerNode"] = relationship(back_populates="peers")


class ConnectionAuditLog(Base):
    """Persisted only when COMPLIANCE_MODE='cert_in_audit' (India CERT-In 2022 commercial VPN mode)."""

    __tablename__ = "connection_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    peer_id: Mapped[int] = mapped_column(ForeignKey("peers.id", ondelete="CASCADE"), index=True, nullable=False)
    server_id: Mapped[int] = mapped_column(ForeignKey("server_nodes.id", ondelete="CASCADE"), index=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    assigned_vpn_ip: Mapped[str] = mapped_column(String(32), nullable=False)
    source_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    retention_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
