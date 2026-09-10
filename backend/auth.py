"""
Auth helpers: password hashing, JWT issue/verify, and FastAPI dependencies
for pulling the current user out of the Authorization header.
"""

import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

try:
    from database import get_db
    from models import User, PatientProfile, Role, CaregiverAssignment
except ImportError:
    from .database import get_db
    from .models import User, PatientProfile, Role, CaregiverAssignment

DEFAULT_SECRET = "cbrain-care-secret-key-change-in-production-2026"
SECRET_KEY = os.getenv("JWT_SECRET", DEFAULT_SECRET).strip() or DEFAULT_SECRET
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))

bearer_scheme = HTTPBearer(auto_error=False)


def _require_secret() -> str:
    global SECRET_KEY
    if not SECRET_KEY:
        SECRET_KEY = DEFAULT_SECRET
    return SECRET_KEY


def hash_password(password: str) -> str:
    secret = password.encode("utf-8")[:72]
    return bcrypt.hashpw(secret, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        secret = password.encode("utf-8")[:72]
        return bcrypt.checkpw(secret, password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_token(user: User) -> str:
    sec = _require_secret()
    payload = {
        "sub": user.id,
        "role": user.role.value,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, sec, algorithm=ALGORITHM)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    sec = _require_secret()
    if creds is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    try:
        payload = jwt.decode(creds.credentials, sec, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token.")

    user = db.get(User, payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive.")
    return user


def require_doctor(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.doctor:
        raise HTTPException(status_code=403, detail="Doctor access required.")
    return user


def require_caregiver(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.caregiver:
        raise HTTPException(status_code=403, detail="Caregiver access required.")
    return user


def require_provider(user: User = Depends(get_current_user)) -> User:
    if user.role not in (Role.doctor, Role.caregiver):
        raise HTTPException(status_code=403, detail="Doctor or caregiver access required.")
    return user


def authorize_patient_access(patient_profile_id: str, user: User, db: Session) -> PatientProfile:
    """Loads a PatientProfile by id and raises 404/403 unless user is allowed."""
    profile = db.get(PatientProfile, patient_profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found.")

    if user.role == Role.doctor:
        if profile.doctor_id != user.id:
            raise HTTPException(status_code=403, detail="Not your patient.")
    elif user.role == Role.caregiver:
        if profile.doctor_id != user.id:
            assignment = db.query(CaregiverAssignment).filter(
                CaregiverAssignment.caregiver_id == user.id,
                CaregiverAssignment.patient_id == profile.id,
            ).first()
            if not assignment:
                raise HTTPException(status_code=403, detail="Not your assigned patient.")
    else:
        if profile.user_id != user.id:
            raise HTTPException(status_code=403, detail="You can only access your own record.")

    return profile