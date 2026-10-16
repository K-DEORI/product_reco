"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight, BookOpen, Heart, ImageOff, Laptop, Leaf, Menu, Search, Shirt, Sofa, Star, Watch, X,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "./auth-context";

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Product = {
  id: number; title: string; brand: string; category: string; price: number; rating: number;
  reviews_count: number; image_url: string; description: string; is_recommended: boolean;
  tags: string[]; score?: number; match_reasons?: string[];
};
type SortKey = "relevance" | "price_asc" | "rating_desc";

const CATEGORIES = [
  { name: "Electronics", icon: Laptop },
  { name: "Fashion", icon: Shirt },
  { name: "Home & Living", icon: Sofa },
  { name: "Accessories", icon: Watch },
  { name: "Books", icon: BookOpen },
] as const;
const TABS = ["Picked for you", ...CATEGORIES.map((c) => c.name)];
const SORTS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Most Relevant" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "rating_desc", label: "Rating: High to Low" },
];
const NAV = [
  { label: "Discover", href: "#top" },
  { label: "Categories", href: "#categories" },
  { label: "For You", href: "#explore" },
  { label: "About", href: "#about" },
];
// Varying image ratios give the grid its gentle, collage-like rhythm.
const ASPECTS = ["aspect-[5/4]", "aspect-[3/4]", "aspect-square", "aspect-[5/4]"];

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));
const scrollToExplore = () => document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" });

/* ------------------------------------------------------------------ */
/* Data hooks                                                          */
/* ------------------------------------------------------------------ */
function useRecommendations(query: string, category: string, sort: SortKey, token: string | null, enabled: boolean) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return; // wait until the saved login has been checked
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`${API}/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        prompt: query,
        category: category === "Picked for you" ? null : category,
        sort,
        limit: 100,
      }),
      signal: ctrl.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Server responded ${r.status}`);
        return r.json();
      })
      .then((d) => setItems(d.items))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [query, category, sort, attempt, token, enabled]);

  return { items, loading, error, retry: () => setAttempt((n) => n + 1) };
}

function useWishlist() {
  const [ids, setIds] = useState<number[]>([]);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      setIds(JSON.parse(localStorage.getItem("smartreco:wishlist") ?? "[]"));
    } catch {
      /* ignore corrupt storage */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem("smartreco:wishlist", JSON.stringify(ids));
    } catch {
      /* storage unavailable */
    }
  }, [ids]);

  const toggle = useCallback(
    (id: number) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])),
    []
  );
  return { ids, toggle };
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */
function ProductImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-accent-terracotta-soft to-warm-beige-deep text-accent-terracotta ${className}`} role="img" aria-label={alt}>
        <ImageOff className="h-8 w-8 opacity-60" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}

function Skeleton({ aspect }: { aspect: string }) {
  const shimmer =
    "bg-[linear-gradient(90deg,#EFE7DB,#F8F2E8,#EFE7DB)] bg-[length:200%_100%] animate-shimmer motion-reduce:animate-none";
  return (
    <div aria-hidden>
      <div className={`${aspect} w-full rounded-2xl ${shimmer}`} />
      <div className={`mt-3 h-4 w-3/4 rounded ${shimmer}`} />
      <div className={`mt-2 h-3 w-1/3 rounded ${shimmer}`} />
      <div className={`mt-3 h-3 w-full rounded ${shimmer}`} />
    </div>
  );
}

function ProductCard({ product, saved, onToggle }: { product: Product; saved: boolean; onToggle: () => void }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="group"
    >
      <div className={`relative overflow-hidden rounded-2xl bg-warm-beige-deep shadow-soft ${ASPECTS[product.id % ASPECTS.length]}`}>
        <ProductImage
          src={product.image_url}
          alt={product.title}
          className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none"
        />
        {product.is_recommended && (
          <span className="absolute left-3 top-3 rounded-full bg-accent-terracotta-soft/95 px-3 py-1 text-xs font-medium text-accent-terracotta-dark backdrop-blur">
            Recommended
          </span>
        )}
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={onToggle}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-warm-beige-card/90 shadow-soft backdrop-blur"
        >
          <Heart className={`h-[18px] w-[18px] ${saved ? "fill-accent-terracotta text-accent-terracotta" : "text-accent-terracotta-dark"}`} />
        </motion.button>
      </div>

      <div className="px-0.5 pt-3">
        <h3 className="font-display text-[17px] leading-snug">{product.title}</h3>
        <p className="mt-0.5 text-sm text-ink">{product.brand}</p>
        <p className="text-sm text-ink-muted">{product.category}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-1 text-sm text-ink-muted">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden />
            <span className="font-medium text-ink">{product.rating.toFixed(1)}</span>
            <span aria-label={`${product.reviews_count} reviews`}>({compact(product.reviews_count)})</span>
          </span>
          <span className="font-medium">{inr.format(product.price)}</span>
        </div>
      </div>
    </motion.article>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */
function Brand() {
  return (
    <a href="#top" className="flex items-center gap-2.5">
      <Leaf className="h-8 w-8 -rotate-12 text-accent-terracotta" aria-hidden />
      <span>
        <span className="block font-display text-2xl leading-none">SmartReco</span>
        <span className="mt-1 hidden text-[11px] leading-none text-ink-muted sm:block">A little more you, in every discovery.</span>
      </span>
    </a>
  );
}

function Header(props: {
  search: string; onSearch: (v: string) => void; wishlistCount: number;
  showSaved: boolean; onToggleSaved: () => void; onForYou: () => void;
}) {
  const { search, onSearch, wishlistCount, showSaved, onToggleSaved, onForYou } = props;
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  const searchField = (
    <label className="flex h-11 items-center gap-2 rounded-full bg-warm-beige-deep px-4 shadow-soft">
      <Search className="h-4 w-4 text-ink-muted" aria-hidden />
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && scrollToExplore()}
        placeholder="Search products..."
        aria-label="Search products"
        className="w-full bg-transparent text-sm placeholder:text-ink-muted/80 focus:outline-none"
      />
    </label>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-ink/5 bg-warm-beige/90 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-6 px-5 lg:px-8">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button className="-ml-2 rounded-full p-2 md:hidden" aria-label="Open menu"><Menu className="h-6 w-6" /></button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 data-[state=open]:animate-fade-in" />
            <Dialog.Content className={`fixed inset-y-0 left-0 z-50 flex w-[80%] max-w-xs flex-col gap-6 bg-warm-beige p-6 font-sans shadow-lift data-[state=open]:animate-drawer-in`}>
              <div className="flex items-center justify-between">
                <Dialog.Title className="font-display text-2xl">SmartReco</Dialog.Title>
                <Dialog.Close className="rounded-full p-2" aria-label="Close menu"><X className="h-5 w-5" /></Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
              {searchField}
              <nav className="flex flex-col gap-1">
                {NAV.map((n) => (
                  <a key={n.label} href={n.href} onClick={() => { setOpen(false); if (n.label === "For You") onForYou(); }}
                    className="rounded-xl px-3 py-3 text-lg hover:bg-warm-beige-deep">{n.label}</a>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-1 border-t border-ink/10 pt-4">
                {user ? (
                  <button onClick={() => { setOpen(false); logout(); }} className="rounded-xl px-3 py-3 text-left text-lg hover:bg-warm-beige-deep">
                    Log out ({user.name})
                  </button>
                ) : (
                  <>
                    <Link href="/login" className="rounded-xl px-3 py-3 text-lg hover:bg-warm-beige-deep">Log in</Link>
                    <Link href="/signup" className="rounded-xl px-3 py-3 text-lg text-accent-terracotta-dark hover:bg-warm-beige-deep">Sign up</Link>
                  </>
                )}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Brand />

        <nav className="ml-6 hidden items-center gap-9 md:flex" aria-label="Primary">
          {NAV.map((n, i) => (
            <a key={n.label} href={n.href} onClick={n.label === "For You" ? onForYou : undefined}
              className={`relative py-2 font-display text-[17px] ${i === 0 ? "text-accent-terracotta-dark after:absolute after:inset-x-0 after:-bottom-[1px] after:h-px after:bg-accent-terracotta" : "text-ink-muted hover:text-ink"}`}>
              {n.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden w-full max-w-xs md:block">{searchField}</div>

        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <button onClick={onToggleSaved} aria-pressed={showSaved}
            aria-label={`Wishlist, ${wishlistCount} saved`}
            className={`relative rounded-full p-2 ${showSaved ? "bg-accent-terracotta-soft" : ""}`}>
            <Heart className={`h-5 w-5 ${showSaved ? "fill-accent-terracotta text-accent-terracotta" : ""}`} />
            {wishlistCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-terracotta px-1 text-[10px] font-semibold text-white">
                {wishlistCount}
              </span>
            )}
          </button>
          {user ? (
            <div className="flex items-center gap-2">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-terracotta-soft font-medium text-accent-terracotta-dark"
                title={user.email} aria-label={`Signed in as ${user.name}`}
              >
                {user.name.trim().charAt(0).toUpperCase()}
              </span>
              <button onClick={logout} className="hidden rounded-full px-3 py-2 text-sm text-ink-muted hover:text-ink sm:block">Log out</button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Link href="/login" className="hidden rounded-full px-3 py-2 text-sm text-ink-muted hover:text-ink sm:block">Log in</Link>
              <Link href="/signup" className="rounded-full bg-accent-terracotta px-4 py-2 text-sm text-white transition-colors hover:bg-accent-terracotta-dark">Sign up</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */
function HeroCollage() {
  const reduce = useReducedMotion();
  const settle = (delay: number, rotate: number) => ({
    initial: reduce ? false : { opacity: 0, y: 24, rotate: rotate - 4 },
    animate: { opacity: 1, y: 0, rotate },
    transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  });
  const frame = "absolute overflow-hidden rounded-xl border-[6px] border-warm-beige-card bg-warm-beige-card shadow-lift";

  return (
    <div className="relative mx-auto hidden h-[340px] w-full max-w-[520px] lg:block" aria-hidden>
      <div className="absolute right-4 top-6 h-64 w-52 rounded-[45%_55%_50%_50%] bg-accent-terracotta-soft/70" />
      <div className="absolute bottom-6 right-0 h-20 w-20 rounded-full bg-accent-terracotta-soft" />
      <Leaf className="absolute -left-2 bottom-2 h-24 w-24 rotate-[25deg] text-sage/80" strokeWidth={1} />

      <motion.div {...settle(0.1, 3)} className={`${frame} left-24 top-0 h-40 w-52`}>
        <ProductImage src="/products/ikea-table-lamp.jpg" alt="" className="h-full w-full" />
      </motion.div>
      <motion.div {...settle(0.25, -6)} className={`${frame} left-6 top-16 h-44 w-36`}>
        <ProductImage src="/products/zara-linen-dress.jpg" alt="" className="h-full w-full" />
      </motion.div>
      <motion.div {...settle(0.4, 4)} className={`${frame} bottom-0 left-[170px] h-56 w-52`}>
        <ProductImage src="/products/sony-wh-ch720n.jpg" alt="" className="h-full w-full" />
      </motion.div>

      <p className="absolute right-0 top-8 w-28 -rotate-6 font-script text-[26px] leading-[1.05] text-ink/80">
        Better choices, happier you <span className="text-accent-terracotta">♡</span>
      </p>
    </div>
  );
}

function Hero({ onDiscover, initial }: { onDiscover: (q: string) => void; initial: string }) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);

  return (
    <section id="top" className="bg-gradient-to-b from-warm-beige-deep to-warm-beige">
      <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 py-14 lg:grid-cols-[1.1fr_1fr] lg:px-8 lg:py-20">
        <div>
          <p className="text-sm tracking-wide text-ink-muted">Your personal discovery space</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.05] sm:text-6xl">
            Find little things<br />you&rsquo;ll love.
          </h1>
          <p className="mt-5 max-w-md font-display text-xl leading-relaxed text-ink-muted">
            Thoughtfully matched products, picked around your style, interests, and budget.
          </p>

          <form
            onSubmit={(e) => { e.preventDefault(); onDiscover(value.trim()); }}
            className="mt-9 flex max-w-xl flex-col gap-3 sm:flex-row"
          >
            <label className="flex h-14 flex-1 items-center gap-3 rounded-full bg-warm-beige-card px-5 shadow-soft">
              <Search className="h-[18px] w-[18px] text-ink-muted" aria-hidden />
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="What are you looking for today?"
                aria-label="What are you looking for today?"
                maxLength={300}
                className="w-full bg-transparent text-[15px] placeholder:text-ink-muted/80 focus:outline-none"
              />
            </label>
            <button type="submit"
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-accent-terracotta px-7 font-display text-lg text-white shadow-soft transition-colors hover:bg-accent-terracotta-dark">
              Discover for me <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </form>
          <p className="mt-3 text-sm text-ink-muted">Try &ldquo;wireless headphones under 15k&rdquo; or &ldquo;a cosy gift for reading&rdquo;.</p>
        </div>
        <HeroCollage />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Page() {
  const [query, setQuery] = useState("");
  const [headerSearch, setHeaderSearch] = useState("");
  const [tab, setTab] = useState("Picked for you");
  const [sort, setSort] = useState<SortKey>("relevance");
  const [showSaved, setShowSaved] = useState(false);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [shownCount, setShownCount] = useState(20);

  const wishlist = useWishlist();
  const { token, loading: authLoading } = useAuth();
  const { items, loading, error, retry } = useRecommendations(query, tab, sort, token, !authLoading);

  // Start from the first page of results whenever the view changes.
  useEffect(() => { setShownCount(20); }, [query, tab, sort, showSaved]);

  // Debounce the header search box.
  useEffect(() => {
    const t = setTimeout(() => setQuery(headerSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [headerSearch]);

  // Full catalog, used to resolve the wishlist view regardless of active tab.
  useEffect(() => {
    fetch(`${API}/api/products`).then((r) => (r.ok ? r.json() : [])).then(setCatalog).catch(() => {});
  }, []);

  const discover = (q: string) => {
    setHeaderSearch(q);
    setQuery(q);
    setTab("Picked for you");
    setShowSaved(false);
    scrollToExplore();
  };
  const pickTab = (name: string) => { setTab(name); setShowSaved(false); };

  const visible = showSaved ? catalog.filter((p) => wishlist.ids.includes(p.id)) : items;
  const isLoading = !showSaved && loading;
  const heading = showSaved ? "Your wishlist" : query ? `Results for “${query}”` : "Explore everything";

  return (
    <div className="min-h-screen font-sans">
      <Header
        search={headerSearch}
        onSearch={setHeaderSearch}
        wishlistCount={wishlist.ids.length}
        showSaved={showSaved}
        onToggleSaved={() => { setShowSaved((s) => !s); scrollToExplore(); }}
        onForYou={() => { pickTab("Picked for you"); setHeaderSearch(""); setQuery(""); }}
      />

      <main>
        <Hero onDiscover={discover} initial={query} />

        {/* Category pills */}
        <section id="categories" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 py-10 lg:px-8" aria-label="Browse by category">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map(({ name, icon: Icon }, i) => (
              <li key={name} className={i === 4 ? "col-span-2 sm:col-span-1" : ""}>
                <button
                  onClick={() => { pickTab(name); scrollToExplore(); }}
                  className={`group flex w-full flex-col items-center gap-2 rounded-[2rem] px-4 pb-4 pt-5 transition-colors ${tab === name && !showSaved ? "bg-accent-terracotta-soft" : "bg-warm-beige-deep hover:bg-accent-terracotta-soft/60"}`}
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-warm-beige-card text-accent-terracotta-dark shadow-soft transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none">
                    <Icon className="h-7 w-7" strokeWidth={1.5} />
                  </span>
                  <span className="font-display text-lg">{name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Explore */}
        <section id="explore" className="mx-auto max-w-[1280px] scroll-mt-20 px-5 pb-20 pt-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
            <h2 className="font-display text-3xl">{heading}</h2>

            <div role="tablist" aria-label="Filter by category" className="-mx-5 flex flex-1 gap-1 overflow-x-auto px-5 lg:mx-0 lg:px-0">
              {TABS.map((name) => {
                const active = tab === name && !showSaved;
                return (
                  <button key={name} role="tab" aria-selected={active} onClick={() => pickTab(name)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${active ? "bg-accent-terracotta-soft text-accent-terracotta-dark" : "text-ink-muted hover:text-ink"}`}>
                    {name}
                  </button>
                );
              })}
            </div>

            <label className="flex w-fit items-center gap-1 rounded-full border border-ink/10 bg-warm-beige-card px-4 py-2 text-sm">
              <span className="text-ink-muted">Sort by:</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort products"
                className="cursor-pointer bg-transparent pr-1 font-medium focus:outline-none">
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {query && !showSaved && (
            <button onClick={() => { setHeaderSearch(""); setQuery(""); }}
              className="mt-4 inline-flex items-center gap-1 rounded-full bg-warm-beige-deep px-3 py-1.5 text-sm text-ink-muted hover:text-ink">
              <X className="h-3.5 w-3.5" /> Clear search
            </button>
          )}

          <div className="mt-8 grid grid-cols-1 items-start gap-x-5 gap-y-9 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-busy={isLoading}>
            {isLoading && Array.from({ length: 10 }, (_, i) => <Skeleton key={i} aspect={ASPECTS[(i + 1) % ASPECTS.length]} />)}
            {!isLoading && (
              <AnimatePresence mode="popLayout">
                {visible.slice(0, shownCount).map((p) => (
                  <ProductCard key={p.id} product={p} saved={wishlist.ids.includes(p.id)} onToggle={() => wishlist.toggle(p.id)} />
                ))}
              </AnimatePresence>
            )}
          </div>

          {!isLoading && visible.length > shownCount && (
            <div className="mt-12 text-center">
              <button onClick={() => setShownCount((n) => n + 20)}
                className="rounded-full border border-ink/10 bg-warm-beige-card px-6 py-3 text-sm shadow-soft transition-colors hover:bg-accent-terracotta-soft">
                Show more <span className="text-ink-muted">({visible.length - shownCount} more)</span>
              </button>
            </div>
          )}

          {!isLoading && error && !showSaved && (
            <div role="alert" className="mx-auto mt-10 max-w-md rounded-2xl bg-warm-beige-deep p-6 text-center">
              <p className="font-display text-xl">We can&rsquo;t reach the recommendation service</p>
              <p className="mt-2 text-sm text-ink-muted">Start the API with <code>uvicorn main:app --reload</code>, then try again.</p>
              <button onClick={retry} className="mt-4 rounded-full bg-accent-terracotta px-5 py-2 text-sm text-white hover:bg-accent-terracotta-dark">Try again</button>
            </div>
          )}

          {!isLoading && !error && visible.length === 0 && (
            <div className="mx-auto mt-10 max-w-md rounded-2xl bg-warm-beige-deep p-6 text-center">
              <p className="font-display text-xl">{showSaved ? "Nothing saved yet" : "No matches found"}</p>
              <p className="mt-2 text-sm text-ink-muted">
                {showSaved ? "Tap the heart on any product to keep it here." : "Try a broader search, a higher budget, or a different category."}
              </p>
            </div>
          )}
        </section>
      </main>

      <footer id="about" className="scroll-mt-20 border-t border-ink/5 bg-warm-beige-deep">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-5 py-10 text-sm text-ink-muted lg:px-8">
          <Brand />
          <p className="mt-2 max-w-lg">SmartReco matches products to your prompt, rating, category and budget so you spend less time scrolling and more time finding things you love.</p>
        </div>
      </footer>
    </div>
  );
}
