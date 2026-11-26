import pytest

from app.services.ip_pool import IPPoolExhaustedError, allocate_next_ip
from app.services.wireguard import (
    derive_public_key,
    generate_keypair,
    generate_preshared_key,
    render_wg_quick_config,
    validate_wireguard_key,
)


def test_x25519_keypair_generation_and_derivation() -> None:
    kp = generate_keypair()
    assert len(kp.private_key) == 44
    assert len(kp.public_key) == 44
    assert derive_public_key(kp.private_key) == kp.public_key
    assert validate_wireguard_key(kp.public_key) == kp.public_key
    assert len(generate_preshared_key()) == 44


def test_invalid_wireguard_key_rejected() -> None:
    with pytest.raises(ValueError):
        validate_wireguard_key("not-a-valid-key")


def test_ip_pool_allocation_and_exhaustion() -> None:
    # /29 has 6 usable hosts: .1 (gateway), .2, .3, .4, .5, .6
    subnet = "10.99.0.0/29"
    used: list[str] = []
    allocated: list[str] = []
    for _ in range(5):
        ip = allocate_next_ip(subnet, used)
        allocated.append(ip)
        used.append(ip)

    assert allocated == ["10.99.0.2", "10.99.0.3", "10.99.0.4", "10.99.0.5", "10.99.0.6"]

    with pytest.raises(IPPoolExhaustedError):
        allocate_next_ip(subnet, used)

    # Freeing .3 allows immediate reuse
    used.remove("10.99.0.3")
    assert allocate_next_ip(subnet, used) == "10.99.0.3"


def test_render_wg_quick_config() -> None:
    kp = generate_keypair()
    srv = generate_keypair()
    psk = generate_preshared_key()
    cfg = render_wg_quick_config(
        client_private_key=kp.private_key,
        assigned_ip="10.8.0.2",
        dns_servers="1.1.1.1,9.9.9.9",
        mtu=1420,
        server_public_key=srv.public_key,
        preshared_key=psk,
        endpoint_host="bom1.indiavpn.example.com",
        listen_port=51820,
    )
    assert f"PrivateKey = {kp.private_key}" in cfg
    assert "Address = 10.8.0.2/32" in cfg
    assert f"PublicKey = {srv.public_key}" in cfg
    assert "Endpoint = bom1.indiavpn.example.com:51820" in cfg
    assert "PersistentKeepalive = 25" in cfg
