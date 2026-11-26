from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "India WireGuard VPN API"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "sqlite:///./india_vpn.db"

    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production-32bytes"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    # "private" = zero connection-history logging (self-hosted personal VPN)
    # "cert_in_audit" = 5-year subscriber/IP/timestamp audit logging (CERT-In 2022 commercial mode)
    COMPLIANCE_MODE: Literal["private", "cert_in_audit"] = "private"
    CERT_IN_RETENTION_DAYS: int = 1825

    WG_DRIVER: Literal["mock", "wg_quick"] = "mock"
    WG_INTERFACE: str = "wg0"
    WG_DEFAULT_MTU: int = 1420
    WG_DEFAULT_DNS: str = "1.1.1.1,9.9.9.9"
    WG_PERSISTENT_KEEPALIVE: int = 25

    SEED_DEFAULT_SERVERS: bool = True
    ADMIN_EMAIL: str = "admin@indiavpn.example.com"
    ADMIN_PASSWORD: str = "ChangeMe123!"


@lru_cache
def get_settings() -> Settings:
    return Settings()
