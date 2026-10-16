"""SmartReco database models (SQLAlchemy) and API schemas (Pydantic)."""
from __future__ import annotations

import os
from typing import Generator, List, Literal, Optional

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import JSON, Boolean, Float, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

# SQLite by default; set DATABASE_URL=postgresql+psycopg2://user:pass@host/db for PostgreSQL.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./smartreco.db")
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


# --------------------------------------------------------------------------- #
# ORM models
# --------------------------------------------------------------------------- #
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    style_preferences: Mapped[list] = mapped_column(JSON, default=list)
    # "budget" | "mid" | "premium"
    budget_tier: Mapped[str] = mapped_column(String(20), default="mid")
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    brand: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(60), index=True)
    price: Mapped[float] = mapped_column(Float)
    rating: Mapped[float] = mapped_column(Float)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0)
    image_url: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    is_recommended: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[list] = mapped_column(JSON, default=list)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------------------------------- #
# Pydantic schemas
# --------------------------------------------------------------------------- #
SortKey = Literal["relevance", "price_asc", "rating_desc"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    style_preferences: List[str] = []
    budget_tier: str = "mid"


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    brand: str
    category: str
    price: float
    rating: float
    reviews_count: int
    image_url: str
    description: str
    is_recommended: bool
    tags: List[str] = []


class RecommendedProduct(ProductOut):
    score: float = Field(0, description="Hybrid score in the range 0-1")
    match_reasons: List[str] = []


class RecommendRequest(BaseModel):
    prompt: str = Field("", max_length=300, description="Free-text discovery prompt")
    category: Optional[str] = Field(None, description="Category tab; null = 'Picked for you'")
    sort: SortKey = "relevance"
    budget_max: Optional[float] = Field(None, ge=0, description="Overrides budget parsed from the prompt")
    user_id: Optional[int] = None
    limit: int = Field(20, ge=1, le=100)


class RecommendResponse(BaseModel):
    query: str
    total: int
    detected_budget: Optional[float] = None
    detected_categories: List[str] = []
    items: List[RecommendedProduct]


# --------------------------------------------------------------------------- #
# Auth schemas
# --------------------------------------------------------------------------- #
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
BudgetTier = Literal["budget", "mid", "premium"]


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)
    style_preferences: List[str] = Field(default_factory=list, max_length=12)
    budget_tier: BudgetTier = "mid"

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("email")
    @classmethod
    def _clean_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("style_preferences")
    @classmethod
    def _clean_styles(cls, v: List[str]) -> List[str]:
        return [s.strip().lower()[:30] for s in v if s.strip()]


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _clean_email(cls, v: str) -> str:
        return v.strip().lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
