from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, PatientProfile, Role
from auth import hash_password, verify_password, create_token, get_current_user, require_doctor, require_provider
from schemas import LoginRequest, DoctorRegister, CaregiverRegister, PatientCreate, TokenResponse

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    return {"access_token": create_token(user), "token_type": "bearer"}


@router.post("/register-doctor", response_model=TokenResponse)
def register_doctor(body: DoctorRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="That username is already taken.")

    user = User(
        name=body.name,
        username=body.username,
        password_hash=hash_password(body.password),
        role=Role.doctor,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_token(user), "token_type": "bearer"}


@router.post("/register-caregiver", response_model=TokenResponse)
def register_caregiver(body: CaregiverRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="That username is already taken.")

    user = User(
        name=body.name,
        username=body.username,
        password_hash=hash_password(body.password),
        role=Role.caregiver,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_token(user), "token_type": "bearer"}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    result = {
        "user_id": user.id,
        "name": user.name,
        "username": user.username,
        "role": user.role.value,
    }
    if user.role == Role.patient and user.patient_profile:
        # This is the id used everywhere else in the app (results, messages,
        # the assistant) — it's the PatientProfile id, not the login id.
        result["patient_id"] = user.patient_profile.id
    return result


@router.post("/patients")
def create_patient(
    body: PatientCreate,
    provider: User = Depends(require_provider),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="That username is already taken.")

    patient_user = User(
        name=body.name,
        username=body.username,
        password_hash=hash_password(body.password),
        role=Role.patient,
    )
    db.add(patient_user)
    db.flush()  # assigns patient_user.id without a full commit yet

    profile = PatientProfile(
        user_id=patient_user.id,
        doctor_id=provider.id,
        details=body.details or {},
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    # NOTE: the frontend uses this single "user_id" value as THE patient id
    # for everything downstream (results, messages, dashboard selection) —
    # so this deliberately returns the PatientProfile id, not the login
    # User id, to keep one consistent id threaded through the whole UI.
    return {"user_id": profile.id}