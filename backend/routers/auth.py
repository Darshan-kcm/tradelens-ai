"""Demo authentication: httpOnly cookie session, no tokens in JSON."""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, HTTPException, Response
from models.schemas import LoginRequest, User

from lib.db import db

router = APIRouter(prefix="/auth", tags=["auth"])
COOKIE_NAME = "tl_session"
SESSION_DAYS = 7


def hash_password(raw: str) -> str:
    return hashlib.sha256(f"tradelens::{raw}".encode()).hexdigest()


async def current_user(token: str | None) -> dict | None:
    if not token:
        return None
    session = await db.sessions.find_one({"token": token}, {"_id": 0})
    if not session:
        return None
    expires = session["expires_at"]
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        await db.sessions.delete_one({"token": token})
        return None
    return await db.users.find_one({"id": session["user_id"]}, {"_id": 0})


@router.post("/login", response_model=User)
async def login(payload: LoginRequest, response: Response):
    user = await db.users.find_one({"email": payload.email.strip().lower()}, {"_id": 0})
    if not user or user["password_hash"] != hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = str(uuid.uuid4())
    await db.sessions.insert_one(
        {
            "token": token,
            "user_id": user["id"],
            "expires_at": datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS),
        }
    )
    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        # "none" is required for cross-site deployments (frontend on Vercel,
        # backend on Render are different origins); it must be paired with
        # secure=True, which is fine since both are served over HTTPS.
        samesite="lax",
        secure=True,
        max_age=SESSION_DAYS * 86400,
        path="/",
    )
    return User(id=user["id"], email=user["email"], name=user["name"], role=user["role"])


@router.get("/me", response_model=User)
async def me(tl_session: str | None = Cookie(default=None)):
    user = await current_user(tl_session)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return User(id=user["id"], email=user["email"], name=user["name"], role=user["role"])


@router.post("/logout")
async def logout(response: Response, tl_session: str | None = Cookie(default=None)):
    if tl_session:
        await db.sessions.delete_one({"token": tl_session})
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}
