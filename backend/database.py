"""
Database engine + session setup.

Supports production PostgreSQL (via DATABASE_URL in environment) as well as
fallback SQLite for local development when PostgreSQL is not configured.
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

raw_url = os.getenv("DATABASE_URL", "").strip()
use_postgres = False
if raw_url:
    if raw_url.startswith("postgres://"):
        raw_url = raw_url.replace("postgres://", "postgresql://", 1)
    DATABASE_URL = raw_url
    try:
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        # Verify connection test
        with engine.connect() as conn:
            pass
        use_postgres = True
    except Exception as e:
        print(f"[database.py] PostgreSQL connection unavailable ({e}). Falling back to SQLite.")

if not use_postgres:
    db_path = os.path.join(os.path.dirname(__file__), "cbrain.db")
    DATABASE_URL = f"sqlite:///{db_path}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

try:
    from . import models  # noqa: F401
except ImportError:
    import models  # noqa: F401


def get_db():
    """FastAPI dependency — yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create database tables if they do not exist."""
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name == "postgresql":
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TYPE role ADD VALUE IF NOT EXISTS 'caregiver';"))
                conn.commit()
            except Exception:
                pass