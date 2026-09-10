import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Text, JSON, Boolean, Integer,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

try:
    from database import Base
except ImportError:
    from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Role(str, enum.Enum):
    doctor = "doctor"
    caregiver = "caregiver"
    patient = "patient"


class User(Base):
    """A login account. Doctors, caregivers, and patients are all Users."""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name = Column(String(200), nullable=False)
    username = Column(String(200), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    _role = Column("role", String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    @property
    def role(self) -> Role:
        return Role(self._role)

    @role.setter
    def role(self, value: Role | str):
        self._role = value.value if isinstance(value, Role) else str(value)

    patients = relationship(
        "PatientProfile", back_populates="doctor",
        foreign_keys="PatientProfile.doctor_id",
    )
    patient_profile = relationship(
        "PatientProfile", back_populates="user", uselist=False,
        foreign_keys="PatientProfile.user_id",
    )
    sent_messages = relationship("Message", back_populates="sender")


class PatientProfile(Base):
    """Clinical record for a patient."""
    __tablename__ = "patient_profiles"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, unique=True)
    doctor_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    details = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="patient_profile", foreign_keys=[user_id])
    doctor = relationship("User", back_populates="patients", foreign_keys=[doctor_id])
    assessment_results = relationship("AssessmentResult", back_populates="patient")
    messages = relationship("Message", back_populates="patient")


class AssessmentResult(Base):
    """One completed assessment session for a patient."""
    __tablename__ = "assessment_results"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patient_profiles.id"), nullable=False)
    protocol_type = Column(String(100), nullable=False)
    data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("PatientProfile", back_populates="assessment_results")


class Message(Base):
    """Chat message between a patient and provider."""
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patient_profiles.id"), nullable=False)
    sender_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime, nullable=True)

    patient = relationship("PatientProfile", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages")


class CaregiverAssignment(Base):
    """Links a caregiver to assigned PatientProfile."""
    __tablename__ = "caregiver_assignments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    caregiver_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patient_profiles.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    caregiver = relationship("User", foreign_keys=[caregiver_id])
    patient = relationship("PatientProfile", foreign_keys=[patient_id])


class CallLog(Base):
    """Call history record tracking voice and video calls."""
    __tablename__ = "call_logs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    caller_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True)
    receiver_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True, index=True)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patient_profiles.id"), nullable=False, index=True)

    caller_name = Column(String(200), nullable=True)
    receiver_name = Column(String(200), nullable=True)
    caller_role = Column(String(50), nullable=False)
    receiver_role = Column(String(50), nullable=True)

    call_type = Column(String(20), nullable=False, default="voice")  # voice | video
    status = Column(String(30), nullable=False, default="initiated", index=True)  # initiated | ringing | accepted | connected | completed | missed | rejected | failed | cancelled

    duration_seconds = Column(Integer, default=0)
    started_at = Column(DateTime, default=datetime.utcnow)
    answered_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    caller = relationship("User", foreign_keys=[caller_id])
    receiver = relationship("User", foreign_keys=[receiver_id])
    patient = relationship("PatientProfile", foreign_keys=[patient_id])