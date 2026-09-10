import os
import json
import logging
from typing import Dict, Optional
import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

try:
    from database import SessionLocal
    from models import User, PatientProfile, Role, CaregiverAssignment
except ImportError:
    from ..database import SessionLocal
    from ..models import User, PatientProfile, Role, CaregiverAssignment

DEFAULT_SECRET = "cbrain-care-secret-key-change-in-production-2026"
SECRET_KEY = os.getenv("JWT_SECRET", DEFAULT_SECRET).strip() or DEFAULT_SECRET
ALGORITHM = "HS256"

router = APIRouter()
logger = logging.getLogger("signaling")


class CallRoomManager:
    """Manages active WebSocket signaling connections grouped by patient_id."""

    def __init__(self):
        # patient_id -> { user_id: { "ws": WebSocket, "user_name": str, "role": str } }
        self.rooms: Dict[str, Dict[str, dict]] = {}

    async def connect(self, patient_id: str, user: User, websocket: WebSocket):
        await websocket.accept()
        if patient_id not in self.rooms:
            self.rooms[patient_id] = {}

        self.rooms[patient_id][user.id] = {
            "ws": websocket,
            "user_name": user.name,
            "role": user.role.value,
        }

        # Notify existing peers in room that a new peer joined
        for uid, peer in self.rooms[patient_id].items():
            if uid != user.id:
                try:
                    await peer["ws"].send_json({
                        "type": "peer-joined",
                        "peer_id": user.id,
                        "peer_name": user.name,
                        "peer_role": user.role.value,
                    })
                except Exception:
                    pass

        # Send current room status to newly connected peer
        existing_peers = [
            {"peer_id": uid, "peer_name": peer["user_name"], "peer_role": peer["role"]}
            for uid, peer in self.rooms[patient_id].items()
            if uid != user.id
        ]
        await websocket.send_json({
            "type": "room-status",
            "patient_id": patient_id,
            "peers": existing_peers,
        })

    def disconnect(self, patient_id: str, user_id: str):
        if patient_id in self.rooms and user_id in self.rooms[patient_id]:
            del self.rooms[patient_id][user_id]
            if not self.rooms[patient_id]:
                del self.rooms[patient_id]

    async def broadcast_to_room(self, patient_id: str, sender_id: str, data: dict):
        if patient_id not in self.rooms:
            return
        for uid, peer in list(self.rooms[patient_id].items()):
            if uid != sender_id:
                try:
                    await peer["ws"].send_json(data)
                except Exception:
                    pass


manager = CallRoomManager()


def _authenticate_ws(token: str, patient_id: str) -> Optional[User]:
    if not token:
        return None
    sec = SECRET_KEY or DEFAULT_SECRET
    try:
        payload = jwt.decode(token, sec, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None

        db: Session = SessionLocal()
        try:
            user = db.get(User, user_id)
            if not user or not user.is_active:
                return None

            profile = db.get(PatientProfile, patient_id)
            if not profile:
                return None

            # Server-side security check: must be patient, doctor, or assigned caregiver
            if user.role == Role.doctor:
                if profile.doctor_id != user.id:
                    return None
            elif user.role == Role.caregiver:
                if profile.doctor_id != user.id:
                    assignment = db.query(CaregiverAssignment).filter(
                        CaregiverAssignment.caregiver_id == user.id,
                        CaregiverAssignment.patient_id == profile.id,
                    ).first()
                    if not assignment:
                        return None
            else:
                if profile.user_id != user.id:
                    return None

            return user
        finally:
            db.close()
    except Exception as e:
        logger.error(f"WS auth error: {e}")
        return None


@router.websocket("/ws/call/{patient_id}")
async def websocket_call_endpoint(websocket: WebSocket, patient_id: str):
    token = websocket.query_params.get("token")
    user = _authenticate_ws(token, patient_id)

    if not user:
        await websocket.close(code=4003, reason="Unauthorized patient call session")
        return

    await manager.connect(patient_id, user, websocket)

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                msg = json.loads(raw_text)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            # Attach sender info to all relayed messages
            msg["sender_id"] = user.id
            msg["sender_name"] = user.name
            msg["sender_role"] = user.role.value

            if msg_type in ("call-request", "call-accepted", "offer", "answer", "ice-candidate", "hangup", "reject", "mic-toggle", "cam-toggle"):
                await manager.broadcast_to_room(patient_id, user.id, msg)

    except WebSocketDisconnect:
        manager.disconnect(patient_id, user.id)
        await manager.broadcast_to_room(patient_id, user.id, {
            "type": "peer-left",
            "peer_id": user.id,
            "peer_name": user.name,
        })
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(patient_id, user.id)
