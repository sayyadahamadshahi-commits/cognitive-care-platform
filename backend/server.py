"""
Cognitive Care API — backend entrypoint.
FastAPI application compatible with local Uvicorn and Vercel serverless functions.
"""

import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

# Ensure backend directory is on sys.path for serverless resolution
backend_dir = os.path.dirname(__file__)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv()

try:
    from database import init_db
    from routes.auth import router as auth_router
    from routes.patients import router as patients_router
    from routes.messages import router as messages_router
    from routes.assistant import router as assistant_router
    from routes.signaling import router as signaling_router
    from routes.calls import router as calls_router
    from services.ai_provider import current_provider, is_configured
except ImportError:
    from .database import init_db
    from .routes.auth import router as auth_router
    from .routes.patients import router as patients_router
    from .routes.messages import router as messages_router
    from .routes.assistant import router as assistant_router
    from .routes.signaling import router as signaling_router
    from .routes.calls import router as calls_router
    from .services.ai_provider import current_provider, is_configured

app = FastAPI(title="Cognitive Care API")

# Initialize database tables on module load
try:
    init_db()
except Exception as e:
    print(f"Warning: Database initialization notice: {e}")


@app.on_event("startup")
def _startup():
    try:
        init_db()
    except Exception as e:
        print(f"Warning: Database initialization notice: {e}")


# ---------------------------------------------------------------------------
# CORS Configuration
# ---------------------------------------------------------------------------
default_origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "null",
]
extra_origins = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=default_origins + extra_origins + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth")
app.include_router(patients_router, prefix="/api/patients")
app.include_router(messages_router, prefix="/api/messages")
app.include_router(assistant_router, prefix="/api/assistant")
app.include_router(signaling_router, prefix="/api")
app.include_router(calls_router, prefix="/api/calls")

# ---------------------------------------------------------------------------
# Serve static assets and index.html
# ---------------------------------------------------------------------------
FRONTEND_DIR = os.getenv("FRONTEND_DIR", os.path.abspath(os.path.join(backend_dir, "..")))
frontend_static = os.path.join(FRONTEND_DIR, "frontend")
if os.path.isdir(frontend_static):
    app.mount("/frontend", StaticFiles(directory=frontend_static), name="frontend")


@app.get("/")
def root():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return {"status": "online", "service": "Cognitive Care API", "provider": current_provider()}


@app.get("/api/health")
def health():
    configured = is_configured()
    return {
        "status": "ok",
        "provider": current_provider(),
        "configured": configured,
        "openai_configured": configured,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)