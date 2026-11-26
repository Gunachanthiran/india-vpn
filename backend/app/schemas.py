from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    is_admin: bool
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class ServerNodeCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=2, max_length=120)
    city: str = Field(min_length=2, max_length=64)
    region_code: str = Field(min_length=2, max_length=64)
    provider: str = Field(min_length=2, max_length=64)
    endpoint_host: str = Field(min_length=3, max_length=255)
    listen_port: int = Field(default=51820, ge=1, le=65535)
    public_key: str = Field(min_length=40, max_length=64)
    subnet_cidr: str = Field(default="10.8.0.0/24")
    dns_servers: str = Field(default="1.1.1.1,9.9.9.9")
    mtu: int = Field(default=1420, ge=1280, le=1500)
    max_peers: int = Field(default=250, ge=1, le=65000)
    latency_ms_estimate: int = Field(default=20, ge=1, le=1000)


class ServerNodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    city: str
    region_code: str
    provider: str
    endpoint_host: str
    listen_port: int
    public_key: str
    subnet_cidr: str
    dns_servers: str
    mtu: int
    max_peers: int
    active_peers: int = 0
    load_percent: int = 0
    latency_ms_estimate: int
    is_active: bool


class PeerCreateRequest(BaseModel):
    server_id: int
    device_name: str = Field(min_length=1, max_length=100)
    client_public_key: str | None = Field(
        default=None,
        description="Optional client-generated WireGuard public key for zero-knowledge key custody.",
    )


class PeerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    server_id: int
    server_slug: str
    server_name: str
    server_city: str
    device_name: str
    public_key: str
    assigned_ip: str
    endpoint: str
    is_active: bool
    created_at: datetime
    revoked_at: datetime | None = None
    has_server_private_key: bool


class PeerProvisionResponse(BaseModel):
    peer: PeerResponse
    client_private_key: str | None = None
    preshared_key: str
    wg_quick_config: str


class PeerConfigResponse(BaseModel):
    peer_id: int
    assigned_ip: str
    endpoint: str
    wg_quick_config: str
    key_custody: Literal["server_generated", "client_managed"]


class TelemetryEventRequest(BaseModel):
    event_type: Literal["connect", "disconnect"]
    note: str | None = Field(default=None, max_length=255)


class TelemetryEventResponse(BaseModel):
    recorded: bool
    compliance_mode: Literal["private", "cert_in_audit"]
    retention_until: datetime | None = None


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    peer_id: int
    server_id: int
    event_type: str
    assigned_vpn_ip: str
    source_ip: str | None
    metadata_note: str | None
    recorded_at: datetime
    retention_until: datetime
