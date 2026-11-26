from fastapi.testclient import TestClient


def test_health_endpoint(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["compliance_mode"] == "private"


def test_register_login_refresh_and_me(client: TestClient) -> None:
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "arjun@example.in",
            "password": "SuperSecretPassword1!",
            "full_name": "Arjun Mehta",
        },
    )
    assert reg.status_code == 201
    data = reg.json()
    assert data["user"]["email"] == "arjun@example.in"
    assert data["user"]["is_admin"] is False
    access_token = data["access_token"]
    refresh_token = data["refresh_token"]

    # Duplicate email returns 409
    dup = client.post(
        "/api/v1/auth/register",
        json={
            "email": "arjun@example.in",
            "password": "SuperSecretPassword1!",
            "full_name": "Arjun Mehta",
        },
    )
    assert dup.status_code == 409

    # /me with access token
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me_res.status_code == 200
    assert me_res.json()["full_name"] == "Arjun Mehta"

    # Bad password fails
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": "arjun@example.in", "password": "wrong-password"},
    )
    assert bad_login.status_code == 401

    # Good login works
    good_login = client.post(
        "/api/v1/auth/login",
        json={"email": "arjun@example.in", "password": "SuperSecretPassword1!"},
    )
    assert good_login.status_code == 200

    # Refresh token issues new pair
    ref_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert ref_res.status_code == 200
    assert ref_res.json()["access_token"]
