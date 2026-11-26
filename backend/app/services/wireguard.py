import base64
import binascii
import os
import subprocess
import tempfile
from dataclasses import dataclass
from typing import Protocol

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey


@dataclass(frozen=True)
class WireGuardKeyPair:
    private_key: str
    public_key: str


def generate_keypair() -> WireGuardKeyPair:
    """Generate a genuine Curve25519 (X25519) WireGuard keypair without shelling out to wg."""
    priv = X25519PrivateKey.generate()
    priv_bytes = priv.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )
    pub_bytes = priv.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return WireGuardKeyPair(
        private_key=base64.b64encode(priv_bytes).decode("ascii"),
        public_key=base64.b64encode(pub_bytes).decode("ascii"),
    )


def derive_public_key(private_key_b64: str) -> str:
    raw = _decode_wg_key(private_key_b64)
    priv = X25519PrivateKey.from_private_bytes(raw)
    pub_bytes = priv.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return base64.b64encode(pub_bytes).decode("ascii")


def generate_preshared_key() -> str:
    return base64.b64encode(os.urandom(32)).decode("ascii")


def _decode_wg_key(key_b64: str) -> bytes:
    try:
        raw = base64.b64decode(key_b64.strip(), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid base64 WireGuard key") from exc
    if len(raw) != 32:
        raise ValueError("WireGuard key must decode to exactly 32 bytes")
    return raw


def validate_wireguard_key(key_b64: str) -> str:
    _decode_wg_key(key_b64)
    return key_b64.strip()


def render_wg_quick_config(
    *,
    client_private_key: str | None,
    assigned_ip: str,
    dns_servers: str,
    mtu: int,
    server_public_key: str,
    preshared_key: str,
    endpoint_host: str,
    listen_port: int,
    persistent_keepalive: int = 25,
) -> str:
    priv_line = client_private_key or "<INSERT_CLIENT_PRIVATE_KEY>"
    return (
        "[Interface]\n"
        f"PrivateKey = {priv_line}\n"
        f"Address = {assigned_ip}/32\n"
        f"DNS = {dns_servers}\n"
        f"MTU = {mtu}\n\n"
        "[Peer]\n"
        f"PublicKey = {server_public_key}\n"
        f"PresharedKey = {preshared_key}\n"
        "AllowedIPs = 0.0.0.0/0, ::/0\n"
        f"Endpoint = {endpoint_host}:{listen_port}\n"
        f"PersistentKeepalive = {persistent_keepalive}\n"
    )


class WireGuardDriver(Protocol):
    def add_peer(self, public_key: str, preshared_key: str, assigned_ip: str) -> None: ...
    def remove_peer(self, public_key: str) -> None: ...
    def active_peer_count(self) -> int: ...


class MockWireGuardDriver:
    """In-memory WireGuard driver used on Windows/dev or when control plane manages remote nodes."""

    def __init__(self) -> None:
        self.peers: dict[str, str] = {}

    def add_peer(self, public_key: str, preshared_key: str, assigned_ip: str) -> None:
        self.peers[public_key] = f"{assigned_ip}/32"

    def remove_peer(self, public_key: str) -> None:
        self.peers.pop(public_key, None)

    def active_peer_count(self) -> int:
        return len(self.peers)


class WgQuickWireGuardDriver:
    """Executes live `wg set` commands against a local Linux WireGuard kernel interface."""

    def __init__(self, interface: str = "wg0") -> None:
        self.interface = interface

    def add_peer(self, public_key: str, preshared_key: str, assigned_ip: str) -> None:
        with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8") as psk_file:
            psk_file.write(preshared_key + "\n")
            psk_path = psk_file.name
        try:
            subprocess.run(
                [
                    "wg",
                    "set",
                    self.interface,
                    "peer",
                    public_key,
                    "preshared-key",
                    psk_path,
                    "allowed-ips",
                    f"{assigned_ip}/32",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
        finally:
            if os.path.exists(psk_path):
                os.remove(psk_path)

    def remove_peer(self, public_key: str) -> None:
        subprocess.run(
            ["wg", "set", self.interface, "peer", public_key, "remove"],
            check=True,
            capture_output=True,
            text=True,
        )

    def active_peer_count(self) -> int:
        res = subprocess.run(
            ["wg", "show", self.interface, "peers"],
            check=True,
            capture_output=True,
            text=True,
        )
        lines = [line for line in res.stdout.splitlines() if line.strip()]
        return len(lines)


def build_wireguard_driver(driver_name: str, interface: str) -> WireGuardDriver:
    if driver_name == "wg_quick":
        return WgQuickWireGuardDriver(interface=interface)
    return MockWireGuardDriver()
