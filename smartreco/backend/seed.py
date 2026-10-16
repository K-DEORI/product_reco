"""Seed SmartReco with mock data (prices in INR) matching the UI reference.

Run:  python seed.py            # seed only if empty
      python seed.py --reset    # drop + reseed
Product images are served by the frontend from /public/products/<file>.
"""
from __future__ import annotations

import sys

from sqlalchemy.orm import Session

from models import Base, Product, SessionLocal, User, engine

PRODUCTS = [
    dict(
        title="Apple AirPods Pro (2nd Gen)", brand="Apple", category="Electronics",
        price=24900, rating=4.6, reviews_count=1200, image_url="/products/airpods-pro.jpg",
        description="Wireless earbuds with active noise cancellation, adaptive transparency and a MagSafe charging case.",
        is_recommended=True,
        tags=["earbuds", "wireless", "noise cancelling", "audio", "music", "apple", "minimal"],
    ),
    dict(
        title="Zara Linen Blend Dress", brand="Zara", category="Fashion",
        price=2999, rating=4.5, reviews_count=642, image_url="/products/zara-linen-dress.jpg",
        description="Breathable sleeveless linen-blend midi dress with a cinched waist. Easy, earthy and made for warm days.",
        is_recommended=False,
        tags=["dress", "linen", "summer", "earthy", "casual", "women", "neutral"],
    ),
    dict(
        title="Dell Inspiron 15", brand="Dell", category="Electronics",
        price=52990, rating=4.4, reviews_count=934, image_url="/products/dell-inspiron-15.jpg",
        description="15.6-inch laptop with a fast processor, 16GB RAM and SSD storage for work, study and everyday creativity.",
        is_recommended=True,
        tags=["laptop", "computer", "work", "study", "productivity", "windows", "student"],
    ),
    dict(
        title="IKEA Table Lamp", brand="IKEA", category="Home & Living",
        price=2499, rating=4.3, reviews_count=623, image_url="/products/ikea-table-lamp.jpg",
        description="A soft fabric-shade lamp that gives bedrooms and reading corners a warm, cosy glow.",
        is_recommended=False,
        tags=["lamp", "lighting", "bedroom", "cosy", "decor", "warm", "minimal"],
    ),
    dict(
        title="Atomic Habits", brand="James Clear", category="Books",
        price=599, rating=4.8, reviews_count=3200, image_url="/products/atomic-habits.jpg",
        description="A practical guide to building good habits and breaking bad ones through small, consistent changes.",
        is_recommended=True,
        tags=["book", "self-help", "habits", "productivity", "bestseller", "reading", "gift"],
    ),
    dict(
        title="Noise ColorFit Pro 5", brand="Noise", category="Electronics",
        price=4999, rating=4.2, reviews_count=856, image_url="/products/noise-colorfit-pro-5.jpg",
        description="Bright AMOLED smartwatch with Bluetooth calling, fitness tracking, sleep monitoring and a week of battery.",
        is_recommended=False,
        tags=["smartwatch", "fitness", "tracker", "wearable", "health", "bluetooth", "budget"],
    ),
    dict(
        title="Skybags Backpack", brand="Skybags", category="Accessories",
        price=2499, rating=4.3, reviews_count=421, image_url="/products/skybags-backpack.jpg",
        description="Water-resistant 30L backpack with a padded laptop sleeve and organised pockets for commutes and weekend trips.",
        is_recommended=False,
        tags=["backpack", "bag", "travel", "college", "laptop bag", "commute", "olive"],
    ),
    dict(
        title="Nike Air Force 1", brand="Nike", category="Fashion",
        price=8995, rating=4.7, reviews_count=1800, image_url="/products/nike-air-force-1.jpg",
        description="The classic low-top leather sneaker in clean white. Cushioned, durable and goes with everything.",
        is_recommended=False,
        tags=["sneakers", "shoes", "footwear", "white", "streetwear", "casual", "classic"],
    ),
    dict(
        title="Sony WH-CH720N", brand="Sony", category="Electronics",
        price=12990, rating=4.5, reviews_count=1400, image_url="/products/sony-wh-ch720n.jpg",
        description="Lightweight over-ear wireless headphones with noise cancelling and up to 35 hours of battery life.",
        is_recommended=False,
        tags=["headphones", "wireless", "noise cancelling", "audio", "music", "travel", "over-ear"],
    ),
    dict(
        title="Fossil Gen 6", brand="Fossil", category="Accessories",
        price=15995, rating=4.2, reviews_count=912, image_url="/products/fossil-gen-6.jpg",
        description="Wear OS smartwatch in blush pink with a stainless steel case, heart-rate tracking and quick charging.",
        is_recommended=False,
        tags=["smartwatch", "watch", "wear os", "fashion", "pink", "wearable", "gift"],
    ),
]

DEMO_USER = dict(
    name="Aarohi",
    email="aarohi@example.com",
    style_preferences=["minimal", "neutral", "cosy", "productivity"],
    budget_tier="mid",
)


def seed_database(db: Session, reset: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
    if db.query(Product).count() == 0:
        db.add_all(Product(**p) for p in PRODUCTS)
    if db.query(User).count() == 0:
        db.add(User(**DEMO_USER))
    db.commit()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_database(session, reset="--reset" in sys.argv)
        print(f"Seeded: {session.query(Product).count()} products, {session.query(User).count()} users")
