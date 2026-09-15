"""Authentication: httpOnly cookie session, no tokens in JSON."""
from __future__ import annotations

import hashlib
import random
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, HTTPException, Response
from models.schemas import LoginRequest, RequestCodeInput, ResetPasswordRequest, SignupRequest, User

from lib import email as email_lib
from lib.db import db

router = APIRouter(prefix="/auth", tags=["auth"])
COOKIE_NAME = "tl_session"
SESSION_DAYS = 7
CODE_TTL_MINUTES = 10
CODE_RESEND_COOLDOWN_SECONDS = 60

GUEST_EMAIL = "guest@tradelens.ai"
GUEST_NAME = "Guest"


def hash_password(raw: str) -> str:
    return hashlib.sha256(f"tradelens::{raw}".encode()).hexdigest()


def _generate_code() -> str:
    return f"{random.randint(0, 999999):06d}"


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


async def _check_code_rate_limit(email: str, purpose: str) -> None:
    recent = await db.verification_codes.find_one(
        {"email": email, "purpose": purpose},
        sort=[("created_at", -1)],
    )
    if recent and recent["created_at"] > datetime.now(timezone.utc) - timedelta(seconds=CODE_RESEND_COOLDOWN_SECONDS):
        raise HTTPException(status_code=429, detail="Please wait a minute before requesting another code")


async def _issue_code(email: str, purpose: str) -> None:
    await _check_code_rate_limit(email, purpose)
    code = _generate_code()
    await db.verification_codes.insert_one(
        {
            "email": email,
            "code": code,
            "purpose": purpose,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES),
            "used": False,
        }
    )
    email_lib.send_verification_code(email, code, purpose)


async def _consume_code(email: str, purpose: str, code: str) -> None:
    record = await db.verification_codes.find_one(
        {"email": email, "purpose": purpose, "code": code.strip(), "used": False},
        sort=[("created_at", -1)],
    )
    if not record:
        raise HTTPException(status_code=400, detail="Invalid code")
    expires_at = record["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This code has expired — request a new one")
    await db.verification_codes.update_one({"_id": record["_id"]}, {"$set": {"used": True}})


@router.post("/request-code")
async def request_code(payload: RequestCodeInput):
    email = payload.email.strip().lower()
    existing = await db.users.find_one({"email": email}, {"_id": 1})
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    await _issue_code(email, "signup")
    return {"ok": True}


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

    await _consume_code(email, "signup", payload.code)

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


@router.post("/guest", response_model=User)
async def guest_login(response: Response):
    user = await db.users.find_one({"email": GUEST_EMAIL}, {"_id": 0})
    if not user:
        user = {
            "id": str(uuid.uuid4()),
            "email": GUEST_EMAIL,
            "name": GUEST_NAME,
            "role": "guest",
            "password_hash": hash_password(str(uuid.uuid4())),
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user)
    await _start_session(user, response)
    return User(id=user["id"], email=user["email"], name=user["name"], role=user["role"])


@router.post("/request-reset-code")
async def request_reset_code(payload: RequestCodeInput):
    email = payload.email.strip().lower()
    existing = await db.users.find_one({"email": email}, {"_id": 1})
    if existing:
        await _issue_code(email, "reset")
    return {"ok": True}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    email = payload.email.strip().lower()
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid code")

    await _consume_code(email, "reset", payload.code)
    await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(payload.new_password)}})
    await db.sessions.delete_many({"user_id": user["id"]})
    return {"ok": True}


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