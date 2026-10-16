"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, Leaf } from "lucide-react";

export function AuthShell({
  title, subtitle, children, footer,
}: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-warm-beige-deep to-warm-beige">
      <div className="mx-auto grid min-h-screen max-w-[1100px] items-center gap-12 px-5 py-10 lg:grid-cols-[1fr_440px]">
        <aside className="hidden lg:block">
          <Link href="/" className="flex items-center gap-2.5">
            <Leaf className="h-9 w-9 -rotate-12 text-accent-terracotta" aria-hidden />
            <span className="font-display text-3xl">SmartReco</span>
          </Link>
          <h2 className="mt-12 max-w-md font-display text-5xl leading-[1.08]">A little more you, in every discovery.</h2>
          <p className="mt-5 max-w-sm font-display text-xl leading-relaxed text-ink-muted">
            Tell us your style and budget once, and your picks get a little more personal every time.
          </p>
          <p className="mt-8 -rotate-3 font-script text-3xl text-ink/80">
            Better choices, happier you <span className="text-accent-terracotta">♡</span>
          </p>
        </aside>

        <section className="rounded-4xl bg-warm-beige-card p-8 shadow-lift sm:p-10">
          <Link href="/" className="mb-6 flex items-center gap-2 lg:hidden">
            <Leaf className="h-7 w-7 -rotate-12 text-accent-terracotta" aria-hidden />
            <span className="font-display text-2xl">SmartReco</span>
          </Link>
          <h1 className="font-display text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>
        </section>
      </div>
    </main>
  );
}

const inputClass =
  "h-12 w-full rounded-xl border border-ink/10 bg-warm-beige px-4 text-[15px] placeholder:text-ink-muted/70 focus:border-accent-terracotta";

type FieldProps = {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; autoComplete?: string; placeholder?: string; hint?: string; maxLength?: number;
};

export function Field({ label, value, onChange, type = "text", autoComplete, placeholder, hint, maxLength }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        required value={value} type={type} autoComplete={autoComplete} placeholder={placeholder} maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)} className={inputClass}
      />
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

export function PasswordField(props: Omit<FieldProps, "type">) {
  const [show, setShow] = useState(false);
  const { label, value, onChange, autoComplete, placeholder, hint } = props;
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <span className="relative block">
        <input
          required value={value} type={show ? "text" : "password"} autoComplete={autoComplete} placeholder={placeholder}
          maxLength={128} onChange={(e) => onChange(e.target.value)} className={`${inputClass} pr-12`}
        />
        <button
          type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-muted hover:text-ink"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-accent-terracotta-soft px-4 py-3 text-sm text-accent-terracotta-dark">
      {message}
    </p>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit" disabled={busy}
      className="h-12 w-full rounded-full bg-accent-terracotta font-display text-lg text-white shadow-soft transition-colors hover:bg-accent-terracotta-dark disabled:opacity-60"
    >
      {busy ? "Please wait…" : children}
    </button>
  );
}
