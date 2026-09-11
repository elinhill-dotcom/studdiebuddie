"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { SUBJECTS } from "@/lib/helpers";
import type { Subject } from "@/lib/types";

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const [hwUserId, setHwUserId] = useState("");
  const [hwTitle, setHwTitle] = useState("");
  const [hwSubject, setHwSubject] = useState<Subject>("Matematik");
  const [hwDue, setHwDue] = useState("");
  const [hwDescription, setHwDescription] = useState("");
  const [hwHelp, setHwHelp] = useState("");
  const [hwPages, setHwPages] = useState("");
  const [hwText, setHwText] = useState("");
  const [hwPhoto, setHwPhoto] = useState<string | undefined>();
  const [hwPdf, setHwPdf] = useState<string | undefined>();
  const [hwPdfName, setHwPdfName] = useState<string | undefined>();

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Kunde inte hämta konton");
      setAuthed(false);
      return;
    }
    setUsers(data.users || []);
  }, []);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then(async (d) => {
        setAuthed(Boolean(d.ok));
        if (d.ok) await loadUsers();
      })
      .finally(() => setChecking(false));
  }, [loadUsers]);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Fel lösenord");
        return;
      }
      setAuthed(true);
      setPassword("");
      await loadUsers();
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthed(false);
    setUsers([]);
  };

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: newName,
          email: newEmail,
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Kunde inte skapa konto");
        return;
      }
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setMessage("Konto skapat.");
      await loadUsers();
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/users/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editName,
          email: editEmail,
          password: editPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Kunde inte spara");
        return;
      }
      setEditId(null);
      setEditPassword("");
      setMessage("Kontot uppdaterat.");
      await loadUsers();
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`Ta bort kontot ${email}? Detta går inte att ångra.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Kunde inte ta bort");
        return;
      }
      setMessage("Konto borttaget.");
      await loadUsers();
    } finally {
      setBusy(false);
    }
  };

  const onAttachment = async (file: File | null) => {
    if (!file) return;
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      if (file.size > 5_000_000) {
        setMessage("PDF:en är för stor (max ca 5 MB).");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setHwPdf(String(reader.result));
        setHwPdfName(file.name);
        setHwPhoto(undefined);
      };
      reader.readAsDataURL(file);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMessage("Välj en bild eller PDF.");
      return;
    }
    if (file.size > 2_500_000) {
      setMessage("Bilden är för stor (max ca 2,5 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setHwPhoto(String(reader.result));
      setHwPdf(undefined);
      setHwPdfName(undefined);
    };
    reader.readAsDataURL(file);
  };

  const assignHomework = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: hwUserId,
          title: hwTitle,
          subject: hwSubject,
          dueDate: hwDue,
          description: hwDescription,
          helpNeeded: hwHelp,
          pageHints: hwPages,
          extractedText: hwText,
          photoDataUrl: hwPhoto,
          pdfDataUrl: hwPdf,
          pdfFileName: hwPdfName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Kunde inte spara läxa");
        return;
      }
      setHwTitle("");
      setHwDescription("");
      setHwHelp("");
      setHwPages("");
      setHwText("");
      setHwPhoto(undefined);
      setHwPdf(undefined);
      setHwPdfName(undefined);
      setMessage("Läxa tilldelad användaren.");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return <p className="text-muted">Laddar admin…</p>;
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-md space-y-5">
        <div>
          <Link href="/" className="text-sm text-muted hover:text-ink">
            ← Hem
          </Link>
          <h1 className="font-display mt-2 text-3xl font-medium tracking-tight">
            Admin
          </h1>
          <p className="mt-1 text-muted">Ange adminlösenord för att fortsätta.</p>
        </div>
        <form onSubmit={login} className="panel space-y-4 p-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Lösenord</span>
            <input
              className="input-field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {message && (
            <p className="rounded-xl bg-coral-soft/60 px-3 py-2 text-sm">{message}</p>
          )}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Vänta…" : "Logga in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-muted hover:text-ink">
            ← Hem
          </Link>
          <h1 className="font-display mt-2 text-3xl font-medium tracking-tight">
            Administrera konton
          </h1>
          <p className="mt-1 text-muted">
            Skapa, ändra och ta bort användare. Tilldela läxor via Supabase.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={logout}>
          Logga ut admin
        </button>
      </div>

      {message && (
        <p className="rounded-xl bg-sage-soft/80 px-3 py-2 text-sm text-ink">
          {message}
        </p>
      )}

      <section className="panel space-y-4 p-5">
        <h2 className="font-display text-xl font-semibold">Skapa konto</h2>
        <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Namn</span>
            <input
              className="input-field"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">E-post</span>
            <input
              className="input-field"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Lösenord</span>
            <input
              className="input-field"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <button type="submit" className="btn-primary sm:col-span-2" disabled={busy}>
            Skapa konto
          </button>
        </form>
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-xl font-semibold">Konton</h2>
        {users.length === 0 ? (
          <p className="text-sm text-muted">Inga konton ännu.</p>
        ) : (
          <ul className="space-y-3">
            {users.map((u) => (
              <li
                key={u.id}
                className="rounded-xl border border-[var(--line)] bg-white/70 p-3"
              >
                {editId === u.id ? (
                  <form onSubmit={saveEdit} className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="input-field"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Namn"
                      required
                    />
                    <input
                      className="input-field"
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="E-post"
                      required
                    />
                    <input
                      className="input-field sm:col-span-2"
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Nytt lösenord (valfritt)"
                    />
                    <div className="flex gap-2 sm:col-span-2">
                      <button type="submit" className="btn-primary text-sm" disabled={busy}>
                        Spara
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-sm"
                        onClick={() => setEditId(null)}
                      >
                        Avbryt
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{u.displayName}</p>
                      <p className="text-sm text-muted">{u.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        onClick={() => {
                          setEditId(u.id);
                          setEditName(u.displayName);
                          setEditEmail(u.email);
                          setEditPassword("");
                        }}
                      >
                        Ändra
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-sm text-coral"
                        onClick={() => deleteUser(u.id, u.email)}
                        disabled={busy}
                      >
                        Ta bort
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel space-y-4 p-5">
        <h2 className="font-display text-xl font-semibold">
          Ladda upp läxa till användare
        </h2>
        <form onSubmit={assignHomework} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Användare</span>
            <select
              className="input-field"
              value={hwUserId}
              onChange={(e) => setHwUserId(e.target.value)}
              required
            >
              <option value="">Välj konto…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} ({u.email})
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Titel</span>
            <input
              className="input-field"
              value={hwTitle}
              onChange={(e) => setHwTitle(e.target.value)}
              required
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Ämne</span>
              <select
                className="input-field"
                value={hwSubject}
                onChange={(e) => setHwSubject(e.target.value as Subject)}
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Datum</span>
              <input
                className="input-field"
                type="date"
                value={hwDue}
                onChange={(e) => setHwDue(e.target.value)}
                required
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Beskrivning</span>
            <textarea
              className="input-field min-h-20"
              value={hwDescription}
              onChange={(e) => setHwDescription(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Hjälpbehov</span>
            <input
              className="input-field"
              value={hwHelp}
              onChange={(e) => setHwHelp(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Sidtips</span>
            <input
              className="input-field"
              value={hwPages}
              onChange={(e) => setHwPages(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Text från häftet</span>
            <textarea
              className="input-field min-h-24"
              value={hwText}
              onChange={(e) => setHwText(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Foto eller PDF (valfritt)</span>
            <input
              className="input-field"
              type="file"
              accept="image/*,application/pdf,.pdf"
              onChange={(e) => void onAttachment(e.target.files?.[0] || null)}
            />
          </label>
          {hwPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hwPhoto}
              alt="Förhandsvisning"
              className="max-h-40 rounded-xl border border-[var(--line)]"
            />
          )}
          {hwPdf && (
            <p className="text-sm text-muted">PDF: {hwPdfName || "dokument.pdf"}</p>
          )}
          <button type="submit" className="btn-primary" disabled={busy}>
            Tilldela läxa
          </button>
        </form>
      </section>
    </div>
  );
}
