import asyncio
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, AssessmentResult
from auth import get_current_user, authorize_patient_access
from services.ai_provider import ask_ai, AIConfigError, current_provider

router = APIRouter()

# Hard ceiling on the whole request, allowing time for full multi-paragraph responses
CHAT_TIMEOUT_SECONDS = 45

LANGUAGE_NAMES = {
    'en': 'English', 'hi': 'Hindi', 'te': 'Telugu', 'ta': 'Tamil', 'kn': 'Kannada',
    'ml': 'Malayalam', 'mr': 'Marathi', 'bn': 'Bengali', 'gu': 'Gujarati',
    'pa': 'Punjabi', 'or': 'Odia', 'as': 'Assamese', 'ur': 'Urdu',
}

SYSTEM_PROMPT_BASE = """You are the Cognitive Care Assistant, embedded in a cognitive
assessment app for patients and caregivers.

You assist with cognitive-assessment information, routines, memory exercises
and general guidance, using the patient data provided to you when relevant.

Rules:
- Do not diagnose medical conditions.
- Do not claim that an assessment proves a medical diagnosis.
- If asked for medical diagnosis or emergency advice, recommend consulting
  an appropriate healthcare professional.
- Provide clear, complete, and helpful answers in plain language. If the user asks for
  exercises, routines, steps, or detailed explanations, provide the complete response
  without truncation or omitting steps.
"""


from typing import Optional

class AssistantRequest(BaseModel):
    message: str
    patient_id: str
    # [{"role": "user"|"assistant", "content": "..."}, ...] — prior turns only.
    conversation: list[dict] = []
    language: str = 'en'
    report_summary: Optional[str] = None


def _build_patient_context(
    patient_id: str,
    user: User,
    db: Session,
    report_summary: Optional[str] = None,
) -> str:
    """Looks up the patient's real record from the DB — scoped by
    authorize_patient_access() — and synthesizes both raw session JSON and a
    structured report summary so the assistant has report context."""
    profile = authorize_patient_access(patient_id, user, db)

    rows = (
        db.query(AssessmentResult)
        .filter(AssessmentResult.patient_id == profile.id)
        .order_by(AssessmentResult.created_at.desc())
        .limit(5)
        .all()
    )
    recent_sessions = []
    report_bullets = []

    for r in rows:
        session_data = r.data or {}
        recent_sessions.append({
            "protocol_type": r.protocol_type,
            "date": r.created_at.isoformat() if r.created_at else None,
            "data": session_data,
        })

        # Synthesize report summary bullets from session results
        task_results = session_data.get("taskResults") or []
        q_results = session_data.get("questionnaireResults") or []
        proto_name = session_data.get("protocolName") or r.protocol_type
        date_str = r.created_at.strftime('%Y-%m-%d') if r.created_at else 'N/A'

        scores = [
            f"{tr.get('taskId')}: SS={tr.get('standardScore')}, class={tr.get('classification')}"
            for tr in task_results if isinstance(tr, dict) and tr.get('taskId')
        ]
        q_scores = []
        for qr in q_results:
            if isinstance(qr, dict) and qr.get('instrumentId'):
                sev = qr.get('severity')
                sev_label = sev.get('label') if isinstance(sev, dict) else (sev or 'N/A')
                q_scores.append(f"{qr.get('instrumentId')}: total={qr.get('totalScore')}, severity={sev_label}")

        bullet = f"- Report ({date_str}, {proto_name}):"
        if scores:
            bullet += " Task Scores: [" + "; ".join(scores) + "]"
        if q_scores:
            bullet += " Questionnaires: [" + "; ".join(q_scores) + "]"
        report_bullets.append(bullet)

    context_str = (
        f"Patient name: {profile.user.name}\n"
        f"Patient details: {json.dumps(profile.details or {}, default=str)[:1000]}\n\n"
        f"Clinical Assessment Report Summaries:\n"
        + ("\n".join(report_bullets) if report_bullets else "No completed assessment reports recorded yet.")
        + "\n\nRecent assessment sessions (most recent first):\n"
        f"{json.dumps(recent_sessions, default=str)[:3000]}"
    )

    if report_summary:
        context_str += f"\n\nLatest Generated Report Summary (Client):\n{report_summary[:2000]}"

    return context_str


@router.post("/chat")
async def chat(
    request: AssistantRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient_context = _build_patient_context(request.patient_id, user, db, request.report_summary)
    lang_name = LANGUAGE_NAMES.get(request.language, 'English')

    system_prompt = (
        SYSTEM_PROMPT_BASE
        + f"\n\nRespond ONLY in {lang_name}, regardless of what language the question was asked in."
        + "\n\n" + patient_context
    )

    messages = [{"role": "system", "content": system_prompt}]
    # Keep only the last few turns so payload/token usage stays bounded.
    messages.extend(request.conversation[-10:])
    messages.append({"role": "user", "content": request.message})

    try:
        answer = await asyncio.wait_for(
            asyncio.to_thread(ask_ai, messages), timeout=CHAT_TIMEOUT_SECONDS
        )
        return {"success": True, "answer": answer, "provider": current_provider()}
    except AIConfigError as e:
        return {"success": False, "error": "config", "answer": str(e)}
    except asyncio.TimeoutError:
        return {
            "success": False,
            "error": "upstream",
            "answer": f"The AI provider took longer than {CHAT_TIMEOUT_SECONDS}s to respond.",
        }
    except Exception as e:
        return {"success": False, "error": "upstream", "answer": str(e)}


@router.get("/health")
async def assistant_health():
    from services.ai_provider import is_configured

    return {"provider": current_provider(), "configured": is_configured()}