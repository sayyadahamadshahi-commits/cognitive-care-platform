from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, field_validator


# ---------------------------------------------------------------------- auth
class LoginRequest(BaseModel):
    username: str
    password: str


class DoctorRegister(BaseModel):
    name: str
    username: str
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class CaregiverRegister(BaseModel):
    name: str
    username: str
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class PatientCreate(BaseModel):
    """Doctor creates/invites a patient account."""
    name: str
    username: str
    password: str
    details: Optional[dict] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class TokenResponse(BaseModel):
    """JWT token response from login/register endpoints."""
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    """User profile response from /me endpoint."""
    user_id: str
    name: str
    role: str
    patient_id: Optional[str] = None   # populated if role == patient
    doctor_id: Optional[str] = None    # populated if role == patient


# ------------------------------------------------------------------ patients
class PatientOut(BaseModel):
    id: str
    name: str
    username: str
    details: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AssessmentResultIn(BaseModel):
    protocol_type: str
    data: dict


class AssessmentResultOut(BaseModel):
    id: str
    patient_id: str
    protocol_type: str
    data: dict
    created_at: datetime

    class Config:
        from_attributes = True


# ------------------------------------------------------------------ messages
class MessageIn(BaseModel):
    body: str


class MessageOut(BaseModel):
    id: str
    patient_id: str
    sender_id: str
    sender_role: str
    body: str
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True