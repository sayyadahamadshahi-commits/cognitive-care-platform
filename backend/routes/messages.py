from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, Message
from auth import get_current_user, authorize_patient_access

router = APIRouter()


def _serialize(msg: Message, sender_role: str) -> dict:
    return {
        "id": msg.id,
        "patient_id": msg.patient_id,
        "sender_id": msg.sender_id,
        "sender_role": sender_role,
        "body": msg.body,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


@router.get("/{patient_id}")
def get_thread(patient_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    authorize_patient_access(patient_id, user, db)  # 403s out anyone but this patient/their doctor
    rows = (
        db.query(Message)
        .filter(Message.patient_id == patient_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    # Threads are small, so one lookup per distinct sender is cheap — a
    # tiny cache just avoids repeating it for every message in the thread.
    role_cache = {}
    out = []
    for m in rows:
        if m.sender_id not in role_cache:
            sender = db.get(User, m.sender_id)
            role_cache[m.sender_id] = sender.role.value if sender else "patient"
        out.append(_serialize(m, role_cache[m.sender_id]))
    return out


class SendMessageRequest(BaseModel):
    body: str


@router.post("/{patient_id}")
def send_message(
    patient_id: str,
    body: SendMessageRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    authorize_patient_access(patient_id, user, db)
    msg = Message(patient_id=patient_id, sender_id=user.id, body=body.body)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    role = user.role.value if hasattr(user.role, "value") else user.role
    return _serialize(msg, role)