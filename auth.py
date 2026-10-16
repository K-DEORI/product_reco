"""Authentication helpers: scrypt password hashing and HS256 bearer tokens (standard library only)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from models import User, get_db

TOKEN_TTL_SECONDS = 7 * 24 * 3600  # 7 days
_SECRET_FILE = Path(__file__).parent / ".secret_key"


def _load_secret() -> bytes:
    """SMARTRECO_SECRET if set; otherwise a random key persisted next to this file."""
    env = os.getenv("SMARTRECO_SECRET")
    if env:
        return env.encode()
    try:
        if _SECRET_FILE.exists():
            return _SECRET_FILE.read_text().strip().encode()
        key = secrets.token_urlsafe(48)
        _SECRET_FILE.write_text(key)
        return key.encode()
    except OSError:
        return secrets.token_urlsafe(48).encode()  # read-only disk: tokens reset on restart


_SECRET = _load_secret()


# --------------------------------------------------------------------------- #
# Passwords
# --------------------------------------------------------------------------- #
_N, _R, _P = 2**14, 8, 1


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    return f"scrypt${_N}${_R}${_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: Optional[str]) -> bool:
    try:
        scheme, n, r, p, salt, digest = (stored or "").split("$")
        if scheme != "scrypt":
            return False
        candidate = hashlib.scrypt(password.encode(), salt=_unb64(salt), n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(candidate, _unb64(digest))
    except (ValueError, TypeError):
        return False


# Used to spend the same time when an email is unknown, so login timing doesn't reveal which emails exist.
DUMMY_HASH = hash_password("smartreco-dummy-password")


# --------------------------------------------------------------------------- #
# Tokens (HS256 JWT)
# --------------------------------------------------------------------------- #
def _sign(signing_input: bytes) -> str:
    return _b64(hmac.new(_SECRET, signing_input, hashlib.sha256).digest())


def create_token(user_id: int) -> str:
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64(json.dumps({"sub": str(user_id), "exp": int(time.time()) + TOKEN_TTL_SECONDS}, separators=(",", ":")).encode())
    signing_input = f"{header}.{payload}".encode()
    return f"{header}.{payload}.{_sign(signing_input)}"


def decode_token(token: str) -> Optional[int]:
    try:
        header, payload, signature = token.split(".")
        if not hmac.compare_digest(signature, _sign(f"{header}.{payload}".encode())):
            return None
        claims = json.loads(_unb64(payload))
        if int(claims["exp"]) < time.time():
            return None
        return int(claims["sub"])
    except (ValueError, KeyError, TypeError):
        return None


# --------------------------------------------------------------------------- #
# FastAPI dependencies
# --------------------------------------------------------------------------- #
_bearer = HTTPBearer(auto_error=False)


def get_optional_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not creds:
        return None
    user_id = decode_token(creds.credentials)
    return db.get(User, user_id) if user_id else None


def get_current_user(user: Optional[User] = Depends(get_optional_user)) -> User:
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please log in to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
