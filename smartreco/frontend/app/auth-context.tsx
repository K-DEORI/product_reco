"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "smartreco:token";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  style_preferences: string[];
  budget_tier: string;
};

export type SignupInput = {
  name: string;
  email: string;
  password: string;
  style_preferences: string[];
  budget_tier: "budget" | "mid" | "premium";
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean; // true until the saved session has been checked
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Turns FastAPI error bodies (string or validation list) into one readable sentence. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail.length) {
      const first = body.detail[0];
      const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "";
      const msg = String(first.msg ?? "Invalid input").replace(/^Value error, /, "");
      return field && field !== "body" ? `${field[0].toUpperCase()}${field.slice(1)}: ${msg}` : msg;
    }
  } catch {
    /* fall through */
  }
  return `Something went wrong (${res.status}). Please try again.`;
}

async function post(path: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("We can't reach the server. Make sure the SmartReco API is running.");
  }
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json() as Promise<{ access_token: string; user: AuthUser }>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
    setUser(null);
    setToken(null);
  }, []);

  // Restore the saved session on first load.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(TOKEN_KEY); } catch { /* storage unavailable */ }
    if (!saved) { setLoading(false); return; }

    const ctrl = new AbortController();
    fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${saved}` }, signal: ctrl.signal })
      .then(async (r) => {
        if (r.ok) { setUser(await r.json()); setToken(saved); }
        else if (r.status === 401) clear(); // expired or invalid
        // other errors: keep the user logged out for now but keep the token for the next visit
      })
      .catch(() => { /* API offline: stay logged out for this visit */ })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [clear]);

  const finish = useCallback((data: { access_token: string; user: AuthUser }) => {
    try { localStorage.setItem(TOKEN_KEY, data.access_token); } catch { /* storage unavailable */ }
    setToken(data.access_token);
    setUser(data.user);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    finish(await post("/api/auth/login", { email, password }));
  }, [finish]);

  const signup = useCallback(async (input: SignupInput) => {
    finish(await post("/api/auth/signup", input));
  }, [finish]);

  const value = useMemo(
    () => ({ user, token, loading, login, signup, logout: clear }),
    [user, token, loading, login, signup, clear]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
