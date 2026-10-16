"""SmartReco hybrid recommender.

Score = 0.5 * text_match + 0.3 * rating + 0.2 * category/budget alignment   (all terms in 0-1)

Text matching uses TF-IDF + cosine similarity (scikit-learn) by default. Set
SMARTRECO_USE_EMBEDDINGS=1 (and `pip install sentence-transformers`) to use
semantic embeddings instead.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import List, Optional, Sequence

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from models import Product, User

W_TEXT, W_RATING, W_ALIGN = 0.5, 0.3, 0.2

CATEGORIES = ["Electronics", "Fashion", "Home & Living", "Accessories", "Books"]

CATEGORY_KEYWORDS = {
    "Electronics": ["electronics", "laptop", "headphones", "headset", "earbuds", "earphones", "smartwatch", "gadget",
                    "audio", "phone", "speaker", "mouse", "keyboard", "monitor", "tablet", "camera", "webcam",
                    "charger", "powerbank", "e-reader", "ereader", "gaming"],
    "Fashion": ["fashion", "dress", "clothes", "clothing", "shoes", "sneakers", "footwear", "outfit", "kurta", "shirt",
                "t-shirt", "tshirt", "saree", "jacket", "boots", "sweater", "sandals", "jeans", "ethnic"],
    "Home & Living": ["home", "living", "lamp", "decor", "bedroom", "furniture", "kitchen", "lighting", "room",
                      "mug", "candle", "cushion", "rug", "planter", "clock", "armchair", "bedding"],
    "Accessories": ["accessories", "accessory", "bag", "backpack", "watch", "wallet", "belt", "sunglasses", "glasses",
                    "necklace", "earrings", "jewellery", "jewelry", "duffle", "tote"],
    "Books": ["book", "books", "read", "reading", "novel", "author", "self-help", "cookbook", "recipes", "poetry",
              "mystery", "encyclopedia"],
}

# (min, max) price per budget tier, in INR
TIER_RANGES = {"budget": (0, 3000), "mid": (0, 15000), "premium": (10000, float("inf"))}

_BUDGET_RE = re.compile(
    r"(?:under|below|less than|within|upto|up to|max(?:imum)?|budget(?: of)?|<=?)\s*"
    r"(?:rs\.?|inr|₹)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakhs?)?",
    re.I,
)


# --------------------------------------------------------------------------- #
# Query understanding
# --------------------------------------------------------------------------- #
def parse_budget(text: str) -> Optional[float]:
    m = _BUDGET_RE.search(text or "")
    if not m:
        return None
    value = float(m.group(1).replace(",", ""))
    unit = (m.group(2) or "").lower()
    if unit in ("k", "thousand"):
        value *= 1_000
    elif unit.startswith("lakh"):
        value *= 100_000
    return value or None


def detect_categories(text: str) -> List[str]:
    words = set(re.findall(r"[a-z\-]+", (text or "").lower()))
    return [cat for cat, kws in CATEGORY_KEYWORDS.items() if words & set(kws)]


# --------------------------------------------------------------------------- #
# Text similarity backends
# --------------------------------------------------------------------------- #
def _doc(p: Product) -> str:
    # Title and tags are repeated so they weigh more than the description.
    return " ".join([p.title, p.title, p.brand, p.category, " ".join(p.tags or []), " ".join(p.tags or []), p.description])


class _TfidfBackend:
    def __init__(self, docs: Sequence[str]):
        self.vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
        self.matrix = self.vec.fit_transform(docs)

    def similarities(self, query: str) -> np.ndarray:
        return cosine_similarity(self.vec.transform([query]), self.matrix).ravel()


class _EmbeddingBackend:
    def __init__(self, docs: Sequence[str]):
        from sentence_transformers import SentenceTransformer  # optional dependency

        self.model = SentenceTransformer("all-MiniLM-L6-v2")
        self.matrix = self.model.encode(list(docs), normalize_embeddings=True)

    def similarities(self, query: str) -> np.ndarray:
        q = self.model.encode([query], normalize_embeddings=True)
        return np.clip((self.matrix @ q.T).ravel(), 0, None)


# --------------------------------------------------------------------------- #
# Scoring
# --------------------------------------------------------------------------- #
@dataclass
class Scored:
    product: Product
    score: float
    reasons: List[str] = field(default_factory=list)


@dataclass
class RecommendResult:
    items: List[Scored]
    total: int
    budget: Optional[float]
    categories: List[str]


def _inr(n: float) -> str:
    return f"₹{n:,.0f}"


class Recommender:
    def __init__(self) -> None:
        self._signature: Optional[tuple] = None
        self._backend = None

    def _ensure_index(self, products: Sequence[Product]) -> None:
        signature = tuple((p.id, p.title, p.description, tuple(p.tags or [])) for p in products)
        if signature == self._signature:
            return
        docs = [_doc(p) for p in products]
        backend = None
        if os.getenv("SMARTRECO_USE_EMBEDDINGS") == "1":
            try:
                backend = _EmbeddingBackend(docs)
            except Exception:  # missing package or model download failed
                backend = None
        self._backend = backend or _TfidfBackend(docs)
        self._signature = signature

    def recommend(
        self,
        products: Sequence[Product],
        *,
        prompt: str = "",
        category: Optional[str] = None,
        sort: str = "relevance",
        budget_max: Optional[float] = None,
        user: Optional[User] = None,
        limit: int = 20,
    ) -> RecommendResult:
        products = list(products)
        if not products:
            return RecommendResult([], 0, None, [])

        query = (prompt or "").strip()
        budget = budget_max or parse_budget(query)
        detected = detect_categories(query)
        tab = category if category in CATEGORIES else None

        sims = np.zeros(len(products))
        if query:
            self._ensure_index(products)
            sims = self._backend.similarities(query)
            top = sims.max()
            sims = sims / top if top > 0 else sims  # normalise so the best match = 1

        user_tags = set((user.style_preferences if user else []) or [])
        scored: List[Scored] = []

        for p, sim in zip(products, sims):
            if tab and p.category != tab:
                continue
            if budget and p.price > budget * 1.25:  # hard cut-off well above budget
                continue

            cat_hit = p.category in detected
            if query and sim < 0.05 and not cat_hit:
                continue  # irrelevant to what was asked

            # 1) text component
            if query:
                text = float(sim)
            else:
                overlap = len(user_tags & set(p.tags or [])) / len(user_tags) if user_tags else 0
                text = max(0.4 + 0.6 * float(p.is_recommended), min(1.0, overlap * 2))

            # 2) rating component
            rating = p.rating / 5.0

            # 3) category + budget alignment
            if tab:
                cat_score = 1.0
            elif detected:
                cat_score = 1.0 if cat_hit else 0.0
            else:
                cat_score = 0.5

            if budget:
                budget_score = 1.0 if p.price <= budget else max(0.0, 1 - (p.price - budget) / budget)
            elif user is not None and user.budget_tier in TIER_RANGES:
                lo, hi = TIER_RANGES[user.budget_tier]
                budget_score = 1.0 if lo <= p.price <= hi else 0.4
            else:
                budget_score = 0.5
            align = (cat_score + budget_score) / 2

            score = W_TEXT * text + W_RATING * rating + W_ALIGN * align

            reasons: List[str] = []
            if query and sim >= 0.3:
                reasons.append("Matches your search")
            if budget and p.price <= budget:
                reasons.append(f"Within {_inr(budget)}")
            if p.rating >= 4.5:
                reasons.append("Highly rated")
            if not query and p.is_recommended:
                reasons.append("Picked for you")
            scored.append(Scored(p, round(score, 4), reasons))

        if sort == "price_asc":
            scored.sort(key=lambda s: (s.product.price, -s.score))
        elif sort == "rating_desc":
            scored.sort(key=lambda s: (-s.product.rating, -s.product.reviews_count))
        else:
            scored.sort(key=lambda s: -s.score)

        return RecommendResult(scored[:limit], len(scored), budget, detected)


recommender = Recommender()
