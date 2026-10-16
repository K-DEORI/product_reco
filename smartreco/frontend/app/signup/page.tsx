"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignupInput, useAuth } from "../auth-context";
import { AuthShell, Field, FormError, PasswordField, SubmitButton } from "../../components/AuthShell";

const STYLES = ["minimal", "cosy", "neutral", "earthy", "casual", "classic", "travel", "productivity"];
const TIERS: { value: SignupInput["budget_tier"]; label: string; note: string }[] = [
  { value: "budget", label: "Budget", note: "Under ₹3,000" },
  { value: "mid", label: "Mid-range", note: "Up to ₹15,000" },
  { value: "premium", label: "Premium", note: "₹10,000 and above" },
];

export default function SignupPage() {
  const { user, loading, signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [styles, setStyles] = useState<string[]>([]);
  const [tier, setTier] = useState<SignupInput["budget_tier"]>("mid");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  const toggleStyle = (s: string) =>
    setStyles((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      await signup({ name, email, password, style_preferences: styles, budget_tier: tier });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Save favourites and get recommendations that fit you."
      footer={<>Already have an account? <Link href="/login" className="font-medium text-accent-terracotta-dark underline underline-offset-4">Log in</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Name" value={name} onChange={setName} autoComplete="name" placeholder="Your name" maxLength={80} />
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" />
        <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters." />

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Your style <span className="font-normal text-ink-muted">(optional)</span></legend>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => {
              const on = styles.includes(s);
              return (
                <button
                  key={s} type="button" aria-pressed={on} onClick={() => toggleStyle(s)}
                  className={`rounded-full px-3.5 py-1.5 text-sm capitalize transition-colors ${on ? "bg-accent-terracotta text-white" : "bg-warm-beige-deep text-ink-muted hover:text-ink"}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Usual budget</legend>
          <div className="grid grid-cols-3 gap-2">
            {TIERS.map((t) => (
              <label
                key={t.value}
                className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-terracotta ${tier === t.value ? "border-accent-terracotta bg-accent-terracotta-soft" : "border-ink/10 hover:border-ink/25"}`}
              >
                <input type="radio" name="tier" value={t.value} checked={tier === t.value} onChange={() => setTier(t.value)} className="sr-only" />
                <span className="block font-medium">{t.label}</span>
                <span className="block text-xs text-ink-muted">{t.note}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <FormError message={error} />
        <SubmitButton busy={busy}>Create account</SubmitButton>
      </form>
    </AuthShell>
  );
}
