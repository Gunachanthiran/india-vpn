from fastapi.testclient import TestClient

from app.services.wireguard import generate_keypair


def _register_and_auth(client: TestClient, email: str = "priya@example.in") -> dict[str, str]:
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPassword123!",
            "full_name": "Priya Nair",
        },
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _login_admin(client: TestClient) -> dict[str, str]:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@indiavpn.example.com", "password": "AdminStrongPassword123!"},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_india_servers_seeded_and_peer_lifecycle(client: TestClient) -> None:
    headers = _register_and_auth(client)

    servers_res = client.get("/api/v1/servers", headers=headers)
    assert servers_res.status_code == 200
    servers = servers_res.json()
    cities = {s["city"] for s in servers}
    assert {"Mumbai", "Hyderabad", "Bangalore", "New Delhi", "Chennai"} <= cities
    mumbai = next(s for s in servers if s["slug"] == "in-bom-aws")

    # Provision server-managed keypair peer
    prov_res = client.post(
        "/api/v1/peers",
        headers=headers,
        json={"server_id": mumbai["id"], "device_name": "Pixel 9 Pro"},
    )
    assert prov_res.status_code == 201
    prov = prov_res.json()
    peer_id = prov["peer"]["id"]
    assert prov["peer"]["assigned_ip"] == "10.8.0.2"
    assert prov["client_private_key"] is not None
    assert "Address = 10.8.0.2/32" in prov["wg_quick_config"]

    # Provision client-managed zero-knowledge peer
    client_kp = generate_keypair()
    prov2_res = client.post(
        "/api/v1/peers",
        headers=headers,
        json={
            "server_id": mumbai["id"],
            "device_name": "iPhone 16",
            "client_public_key": client_kp.public_key,
        },
    )
    assert prov2_res.status_code == 201
    prov2 = prov2_res.json()
    assert prov2["peer"]["assigned_ip"] == "10.8.0.3"
    assert prov2["client_private_key"] is None
    assert "<INSERT_CLIENT_PRIVATE_KEY>" in prov2["wg_quick_config"]

    # Download raw .conf
    raw_res = client.get(f"/api/v1/peers/{peer_id}/config/raw", headers=headers)
    assert raw_res.status_code == 200
    assert "[Interface]" in raw_res.text

    # Render PNG & SVG QR codes
    qr_png = client.get(f"/api/v1/peers/{peer_id}/qr?fmt=png", headers=headers)
    assert qr_png.status_code == 200
    assert qr_png.headers["content-type"] == "image/png"
    assert qr_png.content.startswith(b"\x89PNG")

    qr_svg = client.get(f"/api/v1/peers/{peer_id}/qr?fmt=svg", headers=headers)
    assert qr_svg.status_code == 200
    assert "<svg" in qr_svg.text

    # Private mode telemetry does not persist audit logs
    tel_res = client.post(
        f"/api/v1/peers/{peer_id}/telemetry",
        headers=headers,
        json={"event_type": "connect"},
    )
    assert tel_res.status_code == 200
    assert tel_res.json()["recorded"] is False
    assert tel_res.json()["compliance_mode"] == "private"

    # Revoke first peer and confirm IP .2 is recycled on next provision
    del_res = client.delete(f"/api/v1/peers/{peer_id}", headers=headers)
    assert del_res.status_code == 204

    prov3_res = client.post(
        "/api/v1/peers",
        headers=headers,
        json={"server_id": mumbai["id"], "device_name": "MacBook Air"},
    )
    assert prov3_res.status_code == 201
    assert prov3_res.json()["peer"]["assigned_ip"] == "10.8.0.2"


def test_cert_in_compliance_audit_logging(cert_in_client: TestClient) -> None:
    user_headers = _register_and_auth(cert_in_client, email="vikram@example.in")
    admin_headers = _login_admin(cert_in_client)

    servers = cert_in_client.get("/api/v1/servers", headers=user_headers).json()
    blr = next(s for s in servers if s["slug"] == "in-blr-do")

    prov = cert_in_client.post(
        "/api/v1/peers",
        headers=user_headers,
        json={"server_id": blr["id"], "device_name": "OnePlus 13"},
    ).json()
    peer_id = prov["peer"]["id"]

    tel = cert_in_client.post(
        f"/api/v1/peers/{peer_id}/telemetry",
        headers=user_headers,
        json={"event_type": "connect", "note": "mobile-app"},
    )
    assert tel.status_code == 200
    tel_body = tel.json()
    assert tel_body["recorded"] is True
    assert tel_body["compliance_mode"] == "cert_in_audit"
    assert tel_body["retention_until"] is not None

    # Regular user cannot access admin audit logs
    forbidden = cert_in_client.get("/api/v1/admin/audit-logs", headers=user_headers)
    assert forbidden.status_code == 403

    # Admin sees provision + connect logs
    logs_res = cert_in_client.get("/api/v1/admin/audit-logs", headers=admin_headers)
    assert logs_res.status_code == 200
    logs = logs_res.json()
    event_types = {entry["event_type"] for entry in logs}
    assert {"provision", "connect"} <= event_types


def test_gaming_mode_split_tunnel_and_server_patch(client: TestClient) -> None:
    ping_res = client.get("/api/v1/servers/ping")
    assert ping_res.status_code == 200
    assert ping_res.json()["ok"] is True

    user_headers = _register_and_auth(client, email="gamer@example.in")
    admin_headers = _login_admin(client)
    servers = client.get("/api/v1/servers", headers=user_headers).json()
    mumbai = next(s for s in servers if s["slug"] == "in-bom-aws")

    # Admin updates server with real VPS endpoint & WireGuard key
    real_kp = generate_keypair()
    patch_res = client.patch(
        f"/api/v1/servers/{mumbai['id']}",
        headers=admin_headers,
        json={
            "endpoint_host": "203.0.113.45",
            "listen_port": 51820,
            "public_key": real_kp.public_key,
            "latency_ms_estimate": 28,
        },
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["endpoint_host"] == "203.0.113.45"

    # Provision peer with gaming_mode + BGMI split tunneling
    prov = client.post(
        "/api/v1/peers",
        headers=user_headers,
        json={
            "server_id": mumbai["id"],
            "device_name": "GamingPhone",
            "gaming_mode": True,
            "split_tunnel_apps": "com.pubg.imobile",
        },
    )
    assert prov.status_code == 201
    cfg = prov.json()["wg_quick_config"]
    assert "MTU = 1360" in cfg
    assert "PersistentKeepalive = 15" in cfg
    assert "DNS = 1.1.1.1,8.8.8.8" in cfg
    assert "IncludedApplications = com.pubg.imobile" in cfg
    assert "Endpoint = 203.0.113.45:51820" in cfg

