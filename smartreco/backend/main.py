"""SmartReco API.  Run:  uvicorn main:app --reload --port 8000"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import (
    DUMMY_HASH,
    create_token,
    get_current_user,
    get_optional_user,
    hash_password,
    verify_password,
)
from models import (
    Base,
    LoginRequest,
    Product,
    ProductOut,
    RecommendedProduct,
    RecommendRequest,
    RecommendResponse,
    SessionLocal,
    SignupRequest,
    TokenResponse,
    User,
    UserOut,
    engine,
    get_db,
)
from import_products import import_all
from recommender import CATEGORIES, recommender
from seed import seed_database


def ensure_schema() -> None:
    """Tiny migration: add users.password_hash to databases created before auth existed."""
    columns = {c["name"] for c in inspect(engine).get_columns("users")}
    if "password_hash" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    with SessionLocal() as db:
        seed_database(db)  # no-op when data already exists
        import_all(db)  # adds new products from backend/data/*.json (insert-only)
    yield


app = FastAPI(title="SmartReco API", version="1.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/categories", response_model=List[str])
def categories() -> List[str]:
    return CATEGORIES


@app.get("/api/products", response_model=List[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.query(Product).order_by(Product.id).all()


@app.get("/api/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
@app.post("/api/auth/signup", response_model=TokenResponse, status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        style_preferences=payload.style_preferences,
        budget_tier=payload.budget_tier,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # two signups with the same email at once
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    db.refresh(user)
    return TokenResponse(access_token=create_token(user.id), user=UserOut.model_validate(user))


@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    ok = verify_password(payload.password, user.password_hash if user else DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return TokenResponse(access_token=create_token(user.id), user=UserOut.model_validate(user))


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


# --------------------------------------------------------------------------- #
# Recommendations (personalised when a valid bearer token is sent)
# --------------------------------------------------------------------------- #
@app.post("/api/recommend", response_model=RecommendResponse)
def recommend(
    payload: RecommendRequest,
    db: Session = Depends(get_db),
    current: Optional[User] = Depends(get_optional_user),
) -> RecommendResponse:
    user = current or (db.get(User, payload.user_id) if payload.user_id else None)

    products = db.query(Product).all()
    result = recommender.recommend(
        products,
        prompt=payload.prompt,
        category=payload.category,
        sort=payload.sort,
        budget_max=payload.budget_max,
        user=user,
        limit=payload.limit,
    )

    items = [
        RecommendedProduct(**ProductOut.model_validate(s.product).model_dump(), score=s.score, match_reasons=s.reasons)
        for s in result.items
    ]
    return RecommendResponse(
        query=payload.prompt,
        total=result.total,
        detected_budget=result.budget,
        detected_categories=result.categories,
        items=items,
    )
