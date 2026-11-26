from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings, get_settings
from app.database import Base, get_db
from app.main import create_app, seed_initial_data


def _build_test_app(tmp_path: Path, compliance_mode: str = "private"):
    db_file = tmp_path / "test_india_vpn.db"
    test_settings = Settings(
        DATABASE_URL=f"sqlite:///{db_file}",
        JWT_SECRET_KEY="test-jwt-secret-key-for-pytest-only-32b",
        COMPLIANCE_MODE=compliance_mode,
        WG_DRIVER="mock",
        SEED_DEFAULT_SERVERS=True,
        ADMIN_EMAIL="admin@indiavpn.example.com",
        ADMIN_PASSWORD="AdminStrongPassword123!",
    )
    engine = create_engine(
        test_settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        future=True,
    )
    TestingSessionLocal = sessionmaker(
        bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
    )
    Base.metadata.create_all(bind=engine)
    with TestingSessionLocal() as db:
        seed_initial_data(db, test_settings)

    app = create_app(skip_lifespan_init=True)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_get_settings() -> Settings:
        return test_settings

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = override_get_settings
    return app, test_settings


@pytest.fixture
def client(tmp_path: Path) -> Generator[TestClient, None, None]:
    app, _ = _build_test_app(tmp_path, compliance_mode="private")
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def cert_in_client(tmp_path: Path) -> Generator[TestClient, None, None]:
    app, _ = _build_test_app(tmp_path, compliance_mode="cert_in_audit")
    with TestClient(app) as test_client:
        yield test_client
