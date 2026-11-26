from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import Base, SessionLocal, engine
from app.models import ServerNode, User
from app.routers import admin, auth, peers, servers
from app.security import hash_password
from app.services.wireguard import generate_keypair

DEFAULT_INDIA_SERVERS = [
    {
        "slug": "in-bom-aws",
        "name": "Mumbai 01 (AWS ap-south-1)",
        "city": "Mumbai",
        "region_code": "ap-south-1",
        "provider": "AWS",
        "endpoint_host": "bom1.indiavpn.example.com",
        "listen_port": 51820,
        "subnet_cidr": "10.8.0.0/24",
        "latency_ms_estimate": 14,
    },
    {
        "slug": "in-hyd-aws",
        "name": "Hyderabad 01 (AWS ap-south-2)",
        "city": "Hyderabad",
        "region_code": "ap-south-2",
        "provider": "AWS",
        "endpoint_host": "hyd1.indiavpn.example.com",
        "listen_port": 51820,
        "subnet_cidr": "10.9.0.0/24",
        "latency_ms_estimate": 18,
    },
    {
        "slug": "in-blr-do",
        "name": "Bangalore 01 (DigitalOcean blr1)",
        "city": "Bangalore",
        "region_code": "blr1",
        "provider": "DigitalOcean",
        "endpoint_host": "blr1.indiavpn.example.com",
        "listen_port": 51820,
        "subnet_cidr": "10.10.0.0/24",
        "latency_ms_estimate": 16,
    },
    {
        "slug": "in-del-vultr",
        "name": "Delhi NCR 01 (Vultr del)",
        "city": "New Delhi",
        "region_code": "del",
        "provider": "Vultr",
        "endpoint_host": "del1.indiavpn.example.com",
        "listen_port": 51820,
        "subnet_cidr": "10.11.0.0/24",
        "latency_ms_estimate": 22,
    },
    {
        "slug": "in-maa-linode",
        "name": "Chennai 01 (Linode in-maa)",
        "city": "Chennai",
        "region_code": "in-maa",
        "provider": "Linode",
        "endpoint_host": "maa1.indiavpn.example.com",
        "listen_port": 51820,
        "subnet_cidr": "10.12.0.0/24",
        "latency_ms_estimate": 24,
    },
]


def seed_initial_data(db: Session, settings: Settings) -> None:
    admin_user = db.scalar(select(User).where(User.email == settings.ADMIN_EMAIL.lower()))
    if admin_user is None:
        db.add(
            User(
                email=settings.ADMIN_EMAIL.lower(),
                full_name="India VPN Admin",
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                is_admin=True,
                is_active=True,
            )
        )

    if settings.SEED_DEFAULT_SERVERS:
        existing_slugs = set(db.scalars(select(ServerNode.slug)).all())
        for spec in DEFAULT_INDIA_SERVERS:
            if spec["slug"] not in existing_slugs:
                db.add(
                    ServerNode(
                        slug=spec["slug"],
                        name=spec["name"],
                        city=spec["city"],
                        region_code=spec["region_code"],
                        provider=spec["provider"],
                        endpoint_host=spec["endpoint_host"],
                        listen_port=spec["listen_port"],
                        public_key=generate_keypair().public_key,
                        subnet_cidr=spec["subnet_cidr"],
                        dns_servers=settings.WG_DEFAULT_DNS,
                        mtu=settings.WG_DEFAULT_MTU,
                        max_peers=250,
                        latency_ms_estimate=spec["latency_ms_estimate"],
                        is_active=True,
                    )
                )
    db.commit()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_initial_data(db, settings)
    yield


def create_app(skip_lifespan_init: bool = False) -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        lifespan=None if skip_lifespan_init else lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "compliance_mode": settings.COMPLIANCE_MODE,
            "wg_driver": settings.WG_DRIVER,
        }

    app.include_router(auth.router)
    app.include_router(servers.router)
    app.include_router(peers.router)
    app.include_router(admin.router)
    return app


app = create_app()
