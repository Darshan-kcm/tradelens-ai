"""Authentication: httpOnly cookie session, no tokens in JSON.

Two account types share the same users/sessions collections:
- Real accounts, created via POST /auth/signup, password hashed with hash_password.
- Two seeded demo accounts (demo@tradelens.ai / student@tradelens.ai) inserted by
  backend/seed.py, kept working so the app can still be tried without registering.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, HTTPException, Response
from models.schemas import LoginRequest, SignupRequest, User

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


async def _start_session(user: dict, response: Response) -> None:
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
        samesite="lax",
        secure=True,
        max_age=SESSION_DAYS * 86400,
        path="/",
    )


@router.post("/signup", response_model=User, status_code=201)
async def signup(payload: SignupRequest, response: Response):
    email = payload.email.strip().lower()
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name is required")
    if len(payload.password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": name,
        "role": "analyst",
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user)
    await _start_session(user, response)
    return User(id=user["id"], email=user["email"], name=user["name"], role=user["role"])


@router.post("/login", response_model=User)
async def login(payload: LoginRequest, response: Response):
    user = await db.users.find_one({"email": payload.email.strip().lower()}, {"_id": 0})
    if not user or user["password_hash"] != hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await _start_session(user, response)
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