from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import ConnectionAuditLog, User
from app.schemas import AuditLogResponse
from app.security import require_admin

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/compliance")
def get_compliance_status(
    _admin: Annotated[User, Depends(require_admin)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    return {
        "compliance_mode": settings.COMPLIANCE_MODE,
        "retention_days": settings.CERT_IN_RETENTION_DAYS if settings.COMPLIANCE_MODE == "cert_in_audit" else 0,
        "logging_enabled": settings.COMPLIANCE_MODE == "cert_in_audit",
    }


@router.get("/audit-logs", response_model=list[AuditLogResponse])
def list_audit_logs(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
    limit: int = Query(default=100, ge=1, le=1000),
) -> list[AuditLogResponse]:
    logs = db.scalars(
        select(ConnectionAuditLog).order_by(ConnectionAuditLog.recorded_at.desc()).limit(limit)
    ).all()
    return [AuditLogResponse.model_validate(item) for item in logs]
