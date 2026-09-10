from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

try:
    from database import get_db
    from models import User, PatientProfile, CallLog, Role, CaregiverAssignment
    from auth import get_current_user, authorize_patient_access
except ImportError:
    from ..database import get_db
    from ..models import User, PatientProfile, CallLog, Role, CaregiverAssignment
    from ..auth import get_current_user, authorize_patient_access

router = APIRouter()


class InitiateCallRequest(BaseModel):
    patient_id: str
    call_type: str = "voice"  # voice | video
    receiver_id: Optional[str] = None


class EndCallRequest(BaseModel):
    duration_seconds: int = 0


def _serialize_call_log(log: CallLog) -> dict:
    return {
        "id": log.id,
        "caller_id": log.caller_id,
        "receiver_id": log.receiver_id,
        "patient_id": log.patient_id,
        "caller_name": log.caller_name or "Caller",
        "receiver_name": log.receiver_name or "Participant",
        "caller_role": log.caller_role,
        "receiver_role": log.receiver_role,
        "call_type": log.call_type,
        "status": log.status,
        "duration_seconds": log.duration_seconds or 0,
        "started_at": log.started_at.isoformat() if log.started_at else None,
        "answered_at": log.answered_at.isoformat() if log.answered_at else None,
        "ended_at": log.ended_at.isoformat() if log.ended_at else None,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


def _get_authorized_patient_ids(user: User, db: Session) -> List[str]:
    if user.role == Role.doctor:
        profiles = db.query(PatientProfile).filter(PatientProfile.doctor_id == user.id).all()
        return [p.id for p in profiles]
    elif user.role == Role.caregiver:
        assignments = db.query(CaregiverAssignment).filter(CaregiverAssignment.caregiver_id == user.id).all()
        return [a.patient_id for a in assignments]
    elif user.role == Role.patient and user.patient_profile:
        return [user.patient_profile.id]
    return []


@router.get("")
def list_calls(
    status_filter: Optional[str] = Query(None),
    type_filter: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch call history logs scoped by user role authorization."""
    patient_ids = _get_authorized_patient_ids(user, db)

    query = db.query(CallLog).filter(
        or_(
            CallLog.caller_id == user.id,
            CallLog.receiver_id == user.id,
            CallLog.patient_id.in_(patient_ids) if patient_ids else False
        )
    )

    if status_filter:
        if status_filter == "missed":
            query = query.filter(CallLog.status.in_(["missed", "rejected"]))
        else:
            query = query.filter(CallLog.status == status_filter)

    if type_filter and type_filter in ("voice", "video"):
        query = query.filter(CallLog.call_type == type_filter)

    logs = query.order_by(desc(CallLog.created_at)).limit(limit).all()
    return [_serialize_call_log(log) for log in logs]


@router.get("/recent")
def recent_calls(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch top 10 recent calls for current user."""
    return list_calls(limit=10, user=user, db=db)


@router.get("/missed")
def missed_calls(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch missed/rejected calls for current user."""
    return list_calls(status_filter="missed", limit=20, user=user, db=db)


@router.post("/initiate")
def initiate_call(
    body: InitiateCallRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Initiate a call session, validating patient authorization server-side."""
    profile = authorize_patient_access(body.patient_id, user, db)

    # Determine receiver if not explicitly provided
    receiver_user = None
    if body.receiver_id:
        receiver_user = db.get(User, body.receiver_id)
    if not receiver_user:
        if user.role == Role.patient:
            receiver_user = db.get(User, profile.doctor_id)
        else:
            receiver_user = profile.user

    receiver_id = receiver_user.id if receiver_user else profile.user_id
    receiver_name = receiver_user.name if receiver_user else "Patient"
    receiver_role = receiver_user.role.value if receiver_user else "patient"

    log = CallLog(
        caller_id=user.id,
        receiver_id=receiver_id,
        patient_id=profile.id,
        caller_name=user.name,
        receiver_name=receiver_name,
        caller_role=user.role.value,
        receiver_role=receiver_role,
        call_type=body.call_type if body.call_type in ("voice", "video") else "voice",
        status="initiated",
        started_at=datetime.utcnow(),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return _serialize_call_log(log)


@router.post("/{call_id}/accept")
def accept_call_log(
    call_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record call acceptance."""
    log = db.get(CallLog, call_id)
    if not log:
        raise HTTPException(status_code=404, detail="Call record not found.")

    log.status = "connected"
    log.answered_at = datetime.utcnow()
    db.commit()
    db.refresh(log)
    return _serialize_call_log(log)


@router.post("/{call_id}/reject")
def reject_call_log(
    call_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record call rejection."""
    log = db.get(CallLog, call_id)
    if not log:
        raise HTTPException(status_code=404, detail="Call record not found.")

    log.status = "rejected"
    log.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(log)
    return _serialize_call_log(log)


@router.post("/{call_id}/cancel")
def cancel_call_log(
    call_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record missed/cancelled call."""
    log = db.get(CallLog, call_id)
    if not log:
        raise HTTPException(status_code=404, detail="Call record not found.")

    log.status = "missed"
    log.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(log)
    return _serialize_call_log(log)


@router.post("/{call_id}/end")
def end_call_log(
    call_id: str,
    body: EndCallRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record call completion and duration."""
    log = db.get(CallLog, call_id)
    if not log:
        raise HTTPException(status_code=404, detail="Call record not found.")

    log.status = "completed"
    log.duration_seconds = max(0, body.duration_seconds)
    log.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(log)
    return _serialize_call_log(log)
