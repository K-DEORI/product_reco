"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Heart, Star, ShoppingCart } from "lucide-react";
import { useAuth } from "../../auth-context";
import { useCart } from "../../cart-context";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Product = {
  id: number; title: string; brand: string; category: string; price: number; rating: number;
  reviews_count: number; image_url: string; description: string; is_recommended: boolean;
  tags: string[];
};

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { addItem } = useCart();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`${API}/api/products/${productId}`);
        if (!res.ok) throw new Error(`Product not found (${res.status})`);
        const p = await res.json();
        setProduct(p);

        // Fetch similar products using the same category
        const recRes = await fetch(`${API}/api/recommend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `Products similar to ${p.title}`,
            category: p.category,
            sort: "relevance",
            limit: 5,
          }),
        });
        if (recRes.ok) {
          const recData = await recRes.json();
          setSimilar(recData.items.map((item: any) => item.product || item));
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [productId]);

  useEffect(() => {
    const ids = JSON.parse(localStorage.getItem("smartreco:wishlist") ?? "[]");
    setSaved(product && ids.includes(product.id));
  }, [product]);

  const toggleWishlist = () => {
    const ids: number[] = JSON.parse(localStorage.getItem("smartreco:wishlist") ?? "[]");
    const newIds = saved ? ids.filter((id) => id !== product?.id) : [...ids, product?.id!];
    localStorage.setItem("smartreco:wishlist", JSON.stringify(newIds));
    setSaved(!saved);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-warm-beige">
      <div className="animate-pulse text-ink-muted font-display text-xl">Loading product details...</div>
    </div>
  );

  if (error || !product) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-warm-beige p-5 text-center">
      <h1 className="font-display text-3xl text-ink">{error || "Product not found"}</h1>
      <Link href="/" className="mt-6 rounded-full bg-accent-terracotta px-6 py-2 text-white hover:bg-accent-terracotta-dark transition-colors">
        Return Home
      </Link>
    </div>
  );

  const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

  return (
    <div className="min-h-screen bg-warm-beige font-sans text-ink">
      {/* Navigation */}
      <nav className="sticky top-0 z-30 border-b border-ink/5 bg-warm-beige/90 backdrop-blur px-5 py-4">
        <div className="mx-auto max-w-[1280px]">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Discovery
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-[1280px] px-5 py-10 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start">
          {/* Image Section */}
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-warm-beige-deep shadow-soft">
            <img
              src={product.image_url}
              alt={product.title}
              className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
            />
          </div>

          {/* Details Section */}
          <div className="flex flex-col gap-6">
            <div>
              <span className="inline-block rounded-full bg-accent-terracotta-soft px-3 py-1 text-xs font-medium text-accent-terracotta-dark uppercase tracking-wider">
                {product.category}
              </span>
              <h1 className="mt-3 font-display text-4xl leading-tight">{product.title}</h1>
              <p className="mt-1 text-lg text-ink-muted">{product.brand}</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-lg">
                <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                <span className="font-bold">{product.rating.toFixed(1)}</span>
                <span className="text-ink-muted">({product.reviews_count} reviews)</span>
              </div>
              <div className="h-4 w-px bg-ink/20" />
              <span className="text-3xl font-display font-semibold text-accent-terracotta-dark">
                {inr.format(product.price)}
              </span>
            </div>

            <div className="space-y-3 border-y border-ink/10 py-6">
              <h3 className="font-display text-lg">Description</h3>
              <p className="leading-relaxed text-ink-muted">
                {product.description}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => addItem(product.id)}
                className="flex-1 flex items-center justify-center gap-2 rounded-full px-8 py-4 font-display text-lg transition-all shadow-soft bg-accent-terracotta text-white hover:bg-accent-terracotta-dark"
              >
                <ShoppingCart className="h-5 w-5" />
                Add to Cart
              </button>
              <button
                onClick={toggleWishlist}
                className={`flex-1 flex items-center justify-center gap-2 rounded-full px-8 py-4 font-display text-lg transition-all shadow-soft ${saved ? "bg-accent-terracotta text-white" : "bg-warm-beige-card text-ink hover:bg-warm-beige-deep"}`}
              >
                <Heart className={`h-5 w-5 ${saved ? "fill-current" : ""}`} />
                {saved ? "Saved" : "Wishlist"}
              </button>
            </div>
          </div>
        </div>

        {/* Similar Products Section */}
        <section className="mt-24">
          <h2 className="font-display text-3xl mb-8">You might also love</h2>
          <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {similar.length > 0 ? similar.map((p) => (
              <ProductLink key={p.id} product={p} />
            )) : (
              <div className="col-span-full text-center py-10 text-ink-muted">
                No similar products found.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function ProductLink({ product }: { product: Product }) {
  return (
    <Link href={`/products/${product.id}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl bg-warm-beige-deep shadow-soft aspect-square">
        <img
          src={product.image_url}
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="px-0.5 pt-3">
        <h3 className="font-display text-[17px] leading-snug group-hover:text-accent-terracotta transition-colors">{product.title}</h3>
        <p className="mt-0.5 text-sm text-ink">{product.brand}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-medium text-ink">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(product.price)}</span>
        </div>
      </div>
    </Link>
  );
}
