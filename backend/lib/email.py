"""Transactional email via Resend (resend.com, free tier: 3,000/month,
100/day, no card required). Used for signup verification codes and
password-reset codes.

If RESEND_API_KEY isn't set, codes are printed to the backend console
instead of emailed — keeps local development working without a Resend
account, while production (with the key set) sends real email.
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
FROM_EMAIL = os.environ.get("FROM_EMAIL", "TradeLens AI <onboarding@resend.dev>").strip()

_client = None
if RESEND_API_KEY:
    import resend

    resend.api_key = RESEND_API_KEY
    _client = resend


def send_verification_code(to_email: str, code: str, purpose: str) -> None:
    subject = "Verify your email" if purpose == "signup" else "Reset your password"
    action = "finish creating your account" if purpose == "signup" else "reset your password"
    html = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #0b192c;">TradeLens AI</h2>
      <p>Use this code to {action}:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0b192c;">{code}</p>
      <p style="color: #64748b; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>
    """

    if not _client:
        logger.warning("RESEND_API_KEY not set — verification code for %s (%s): %s", to_email, purpose, code)
        return

    try:
        _client.Emails.send(
            {
                "from": FROM_EMAIL,
                "to": [to_email],
                "subject": subject,
                "html": html,
            }
        )
    except Exception as exc:
        logger.error("Failed to send email to %s via Resend: %s", to_email, exc)
        raise