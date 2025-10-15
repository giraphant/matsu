"""
Simple authentication API endpoints.
For a simplified multi-user system where only login is required.
All configurations are shared - only authentication separates users.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict
import secrets
from datetime import datetime, timedelta

from app.models.database import get_db, User

router = APIRouter()

# Simple in-memory session storage
# Format: {token: {"username": str, "expires_at": datetime}}
sessions: Dict[str, dict] = {}


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    username: Optional[str] = None
    message: Optional[str] = None


class SessionResponse(BaseModel):
    authenticated: bool
    username: Optional[str] = None


def create_session(username: str) -> str:
    """Create a new session token."""
    token = secrets.token_urlsafe(32)
    sessions[token] = {
        "username": username,
        "expires_at": datetime.utcnow() + timedelta(days=7)
    }
    return token


def get_session(token: str) -> Optional[dict]:
    """Get session data if valid."""
    if token not in sessions:
        return None

    session = sessions[token]
    if datetime.utcnow() > session["expires_at"]:
        del sessions[token]
        return None

    return session


def cleanup_expired_sessions():
    """Remove expired sessions."""
    now = datetime.utcnow()
    expired = [token for token, data in sessions.items() if now > data["expires_at"]]
    for token in expired:
        del sessions[token]


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Simple login - verify username and password, return session token."""
    cleanup_expired_sessions()

    user = db.query(User).filter(User.username == request.username).first()

    if not user or not user.verify_password(request.password):
        return LoginResponse(success=False, message="Invalid username or password")

    if not user.is_active:
        return LoginResponse(success=False, message="Account is inactive")

    # Create session token
    token = create_session(user.username)

    return LoginResponse(
        success=True,
        token=token,
        username=user.username,
        message="Login successful"
    )


@router.post("/logout")
def logout(authorization: Optional[str] = Header(None)):
    """Logout - invalidate session token."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        if token in sessions:
            del sessions[token]

    return {"success": True, "message": "Logged out successfully"}


@router.get("/session", response_model=SessionResponse)
def check_session(authorization: Optional[str] = Header(None)):
    """Check if current session is valid."""
    if not authorization or not authorization.startswith("Bearer "):
        return SessionResponse(authenticated=False)

    token = authorization.replace("Bearer ", "")
    session = get_session(token)

    if not session:
        return SessionResponse(authenticated=False)

    return SessionResponse(
        authenticated=True,
        username=session["username"]
    )
