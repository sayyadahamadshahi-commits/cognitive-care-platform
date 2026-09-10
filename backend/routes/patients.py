from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import User, PatientProfile, AssessmentResult, Message, Role, gen_uuid, CaregiverAssignment
from auth import get_current_user, require_doctor, require_provider, authorize_patient_access

router = APIRouter()


def _serialize_patient(profile: PatientProfile) -> dict:
    doc = profile.doctor
    return {
        "id": profile.id,
        "patient_id": profile.id,
        "user_id": profile.user_id,
        "name": profile.user.name,
        "username": profile.user.username,
        "doctor_id": profile.doctor_id,
        "doctor_name": doc.name if doc else None,
        "doctor_username": doc.username if doc else None,
        "details": profile.details or {},
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
    }


# ---------------------------------------------------------------------------
# GET /api/patients/me/doctor  —  authenticated patient gets doctor info
# ---------------------------------------------------------------------------
@router.get("/me/doctor")
def my_doctor(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns only the authenticated patient's authorized attending doctor information."""
    if user.role != Role.patient or not user.patient_profile:
        raise HTTPException(status_code=404, detail="No patient profile for this account.")
    doc = user.patient_profile.doctor
    if not doc:
        return {"doctor": None}
    return {
        "doctor": {
            "id": doc.id,
            "name": doc.name,
            "username": doc.username,
            "role": doc.role.value if hasattr(doc, "role") and doc.role else "doctor",
            "is_active": doc.is_active,
        }
    }


# ---------------------------------------------------------------------------
# GET /api/patients  —  provider's own & assigned patient list
# ---------------------------------------------------------------------------
@router.get("")
def list_patients(provider: User = Depends(require_provider), db: Session = Depends(get_db)):
    """Only this provider's (doctor or caregiver) own/assigned patients — never the whole table."""
    if provider.role == Role.doctor:
        profiles = (
            db.query(PatientProfile)
            .filter(PatientProfile.doctor_id == provider.id)
            .all()
        )
    elif provider.role == Role.caregiver:
        assignments = (
            db.query(CaregiverAssignment)
            .filter(CaregiverAssignment.caregiver_id == provider.id)
            .all()
        )
        assigned_patient_ids = [a.patient_id for a in assignments]
        if not assigned_patient_ids:
            profiles = []
        else:
            profiles = (
                db.query(PatientProfile)
                .filter(PatientProfile.id.in_(assigned_patient_ids))
                .all()
            )
    else:
        raise HTTPException(status_code=403, detail="Provider access required.")
    return [_serialize_patient(p) for p in profiles]



@router.get("/caregivers/available")
def list_available_caregivers(doctor: User = Depends(require_doctor), db: Session = Depends(get_db)):
    """List caregiver users so doctors can assign them to patients."""
    caregivers = db.query(User).filter(User.role == Role.caregiver, User.is_active == True).all()
    return [{"id": c.id, "name": c.name, "username": c.username} for c in caregivers]


@router.post("/{patient_id}/caregivers/{caregiver_id}")
def assign_caregiver(patient_id: str, caregiver_id: str, doctor: User = Depends(require_doctor), db: Session = Depends(get_db)):
    """Doctor assigns a caregiver to a patient."""
    profile = authorize_patient_access(patient_id, doctor, db)
    cg = db.get(User, caregiver_id)
    if not cg or cg.role != Role.caregiver:
        raise HTTPException(status_code=404, detail="Caregiver user not found.")

    existing = db.query(CaregiverAssignment).filter(
        CaregiverAssignment.patient_id == profile.id,
        CaregiverAssignment.caregiver_id == caregiver_id,
    ).first()
    if not existing:
        assign = CaregiverAssignment(patient_id=profile.id, caregiver_id=caregiver_id)
        db.add(assign)
        db.commit()
    return {"status": "assigned", "patient_id": profile.id, "caregiver_id": caregiver_id}


@router.delete("/{patient_id}/caregivers/{caregiver_id}")
def unassign_caregiver(patient_id: str, caregiver_id: str, doctor: User = Depends(require_doctor), db: Session = Depends(get_db)):
    """Doctor unassigns a caregiver from a patient."""
    profile = authorize_patient_access(patient_id, doctor, db)
    db.query(CaregiverAssignment).filter(
        CaregiverAssignment.patient_id == profile.id,
        CaregiverAssignment.caregiver_id == caregiver_id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"status": "unassigned"}


# ---------------------------------------------------------------------------
# GET /api/patients/me  —  patient reads their own profile
# ---------------------------------------------------------------------------
@router.get("/me")
def my_profile(user: User = Depends(get_current_user)):
    if user.role != Role.patient or not user.patient_profile:
        raise HTTPException(status_code=404, detail="No patient profile for this account.")
    return _serialize_patient(user.patient_profile)


# ---------------------------------------------------------------------------
# PATCH /api/patients/{patient_id}  —  update patient profile/name
# ---------------------------------------------------------------------------
class UpdatePatientRequest(BaseModel):
    name: Optional[str] = None
    details: Optional[dict] = None


@router.patch("/{patient_id}")
def update_patient(
    patient_id: str,
    body: UpdatePatientRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = authorize_patient_access(patient_id, user, db)
    if body.name:
        profile.user.name = body.name
    if body.details is not None:
        profile.details = body.details
    db.commit()
    db.refresh(profile)
    return _serialize_patient(profile)


# ---------------------------------------------------------------------------
# DELETE /api/patients/{patient_id}  —  cascading delete (doctor only)
# ---------------------------------------------------------------------------
@router.delete("/{patient_id}", status_code=204)
def delete_patient(
    patient_id: str,
    doctor: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """Permanently deletes the patient's assessment results, messages,
    profile, and login account in one transaction. Only the owning
    doctor may call this endpoint."""
    profile = db.get(PatientProfile, patient_id)
    if not profile:
        profile = db.query(PatientProfile).filter(PatientProfile.user_id == patient_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found.")
    if profile.doctor_id != doctor.id:
        raise HTTPException(status_code=403, detail="Not your patient.")

    patient_user_id = profile.user_id

    # Delete child rows first to satisfy foreign-key constraints
    db.query(AssessmentResult).filter(
        AssessmentResult.patient_id == profile.id
    ).delete(synchronize_session=False)

    db.query(Message).filter(
        Message.patient_id == patient_id
    ).delete(synchronize_session=False)

    db.delete(profile)
    db.flush()  # remove profile before user (profile refs user via FK)

    patient_user = db.get(User, patient_user_id)
    if patient_user:
        db.delete(patient_user)

    db.commit()
    # 204 No Content — no body returned


# ---------------------------------------------------------------------------
# GET /api/patients/{patient_id}/results  —  list assessment results
# ---------------------------------------------------------------------------
@router.get("/{patient_id}/results")
def get_results(
    patient_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = authorize_patient_access(patient_id, user, db)
    rows = (
        db.query(AssessmentResult)
        .filter(AssessmentResult.patient_id == profile.id)
        .order_by(AssessmentResult.created_at.asc())
        .all()
    )
    return [
        {
            "id": r.id,
            "patient_id": r.patient_id,
            "protocol_type": r.protocol_type,
            "data": r.data,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# POST /api/patients/{patient_id}/results  —  upsert an assessment session
# ---------------------------------------------------------------------------
class SaveResultRequest(BaseModel):
    protocol_type: str
    data: dict


@router.post("/{patient_id}/results")
def save_result(
    patient_id: str,
    body: SaveResultRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upsert: if a result with the same frontend session id already exists
    for this patient it is updated in-place (avoids duplicates when the
    frontend re-syncs a partial session as tasks complete); otherwise a
    new row is created.

    The frontend stores its UUID in body.data['id'].  We use that as the
    stable deduplication key so that repeated POSTs for the same in-progress
    session collapse into one database row.
    """
    profile = authorize_patient_access(patient_id, user, db)

    # Try to find an existing row by the frontend-generated session id
    session_id = body.data.get("id") if body.data else None
    valid_session_id = None
    if session_id:
        try:
            uuid.UUID(str(session_id))
            valid_session_id = str(session_id)
        except Exception:
            valid_session_id = None

    existing = None
    if valid_session_id:
        existing = (
            db.query(AssessmentResult)
            .filter(
                AssessmentResult.patient_id == profile.id,
                AssessmentResult.id == valid_session_id,
            )
            .first()
        )

    if existing:
        # Update in-place
        existing.protocol_type = body.protocol_type
        existing.data = body.data
        db.commit()
        db.refresh(existing)
        return {
            "id": existing.id,
            "created_at": existing.created_at.isoformat(),
            "updated": True,
        }
    else:
        # Create new row, using the frontend UUID as the primary key when
        # available so the id is stable across sync calls.
        row = AssessmentResult(
            id=valid_session_id or gen_uuid(),
            patient_id=profile.id,
            protocol_type=body.protocol_type,
            data=body.data,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {
            "id": row.id,
            "created_at": row.created_at.isoformat(),
            "updated": False,
        }