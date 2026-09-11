"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { setProfileName } from "@/lib/store";
import { notifyDataChanged } from "@/components/useAppData";

function KontoForm() {
  const { user, loading, configured, syncing, signIn, signUp, signOut } =
    useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState(
    authError ? "Inloggningen misslyckades. Försök igen." : "",
  );
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      if (mode === "login") {
        const err = await signIn(email.trim(), password);
        if (err) {
          setMessage(err);
          return;
        }
        router.push("/");
        return;
      }

      if (password.length < 6) {
        setMessage("Lösenordet behöver minst 6 tecken.");
        return;
      }
      const err = await signUp(email.trim(), password, displayName);
      if (err) {
        setMessage(err);
        return;
      }
      if (displayName.trim()) {
        setProfileName(displayName.trim());
        notifyDataChanged();
      }
      setMessage(
        "Konto skapat! Kolla mejlen om du behöver bekräfta, annars kan du logga in direkt.",
      );
      setMode("login");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-muted">Laddar konto…</p>;
  }

  if (!configured) {
    return (
      <div className="panel space-y-3 p-5 sm:p-6">
        <h1 className="font-display text-3xl font-medium tracking-tight">
          Konto
        </h1>
        <p className="text-muted">
          Supabase är inte uppsatt ännu. Lägg till{" "}
          <code className="text-sm">NEXT_PUBLIC_SUPABASE_URL</code> och{" "}
          <code className="text-sm">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> i{" "}
          <code className="text-sm">.env.local</code>, kör SQL-schemat i{" "}
          <code className="text-sm">supabase/schema.sql</code>, och starta om
          servern.
        </p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <div>
          <Link href="/" className="text-sm text-muted hover:text-ink">
            ← Hem
          </Link>
          <h1 className="font-display mt-2 text-3xl font-medium tracking-tight">
            Ditt konto
          </h1>
          <p className="mt-1 text-muted">
            Inloggad som {user.email}. Läxor, foton och övrigt sparas i molnet.
          </p>
        </div>
        <div className="panel space-y-4 p-5 sm:p-6">
          {syncing && (
            <p className="text-sm text-sage">Synkar med molnet…</p>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
          >
            Logga ut
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← Hem
        </Link>
        <h1 className="font-display mt-2 text-3xl font-medium tracking-tight">
          {mode === "login" ? "Logga in" : "Skapa konto"}
        </h1>
        <p className="mt-1 text-muted">
          Spara läxor, foton och pluggplan i molnet så du kan fortsätta på flera
          enheter.
        </p>
      </div>

      <form onSubmit={onSubmit} className="panel space-y-4 p-5 sm:p-6">
        {mode === "signup" && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Namn</span>
            <input
              className="input-field"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="T.ex. Alex"
              autoComplete="nickname"
            />
          </label>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">E-post</span>
          <input
            className="input-field"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Lösenord</span>
          <input
            className="input-field"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
        </label>

        {message && (
          <p className="rounded-xl bg-coral-soft/60 px-3 py-2 text-sm text-ink">
            {message}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy
            ? "Vänta…"
            : mode === "login"
              ? "Logga in"
              : "Skapa konto"}
        </button>

        <p className="text-sm text-muted">
          {mode === "login" ? (
            <>
              Inget konto?{" "}
              <button
                type="button"
                className="text-sage underline-offset-2 hover:underline"
                onClick={() => {
                  setMode("signup");
                  setMessage("");
                }}
              >
                Skapa ett
              </button>
            </>
          ) : (
            <>
              Har du konto?{" "}
              <button
                type="button"
                className="text-sage underline-offset-2 hover:underline"
                onClick={() => {
                  setMode("login");
                  setMessage("");
                }}
              >
                Logga in
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  );
}

export default function KontoPage() {
  return (
    <Suspense fallback={<p className="text-muted">Laddar…</p>}>
      <KontoForm />
    </Suspense>
  );
}
