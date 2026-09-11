"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyDataChanged, useAppData } from "@/components/useAppData";
import { parseVocabPaste } from "@/lib/ai-quiz";
import { upsertVocabList } from "@/lib/store";
import type { VocabList } from "@/lib/types";

export default function GlosorPage() {
  const { data, ready, refresh } = useAppData();
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [languageFrom, setLanguageFrom] = useState("engelska");
  const [languageTo, setLanguageTo] = useState("svenska");
  const [paste, setPaste] = useState("");

  if (!ready) return <p className="text-muted">Laddar…</p>;

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const pairs = parseVocabPaste(paste).map((p) => ({
      id: crypto.randomUUID(),
      ...p,
    }));
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const list: VocabList = {
      id: crypto.randomUUID(),
      title: title.trim(),
      languageFrom: languageFrom.trim() || "engelska",
      languageTo: languageTo.trim() || "svenska",
      pairs:
        pairs.length > 0
          ? pairs
          : [{ id: crypto.randomUUID(), term: "", translation: "" }],
      createdAt: now,
      updatedAt: now,
    };
    upsertVocabList(list);
    notifyDataChanged();
    refresh();
    router.push(`/glosor/${list.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Glosor
          </h1>
          <p className="mt-1 max-w-lg text-ink-soft">
            Skapa gloslistor och kör förhör — appen frågar, du svarar. Facit visas
            aldrig under förhöret.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowNew((v) => !v)}
        >
          {showNew ? "Stäng" : "Ny gloslista"}
        </button>
      </div>

      {showNew && (
        <form onSubmit={create} className="panel panel-tint-coral space-y-3 p-5">
          <div>
            <label className="label">Namn</label>
            <input
              className="input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="T.ex. Engelska kapitel 3"
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Från språk</label>
              <input
                className="input-field"
                value={languageFrom}
                onChange={(e) => setLanguageFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Till språk</label>
              <input
                className="input-field"
                value={languageTo}
                onChange={(e) => setLanguageTo(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Klistra in glosor (valfritt)</label>
            <textarea
              className="input-field min-h-28 font-mono text-sm"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"apple - äpple\nbeautiful - vacker\nfriend; vän"}
            />
            <p className="mt-1 text-xs text-muted">
              En rad per glosa: ord - översättning
            </p>
          </div>
          <button type="submit" className="btn-primary">
            Skapa lista
          </button>
        </form>
      )}

      {data.vocabLists.length === 0 ? (
        <div className="panel px-6 py-10 text-center">
          <p className="text-muted">Inga gloslistor ännu.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.vocabLists.map((list) => (
            <Link
              key={list.id}
              href={`/glosor/${list.id}`}
              className="panel block p-5 transition hover:-translate-y-0.5 hover:bg-white/90"
            >
              <span className="tag bg-coral-soft text-coral">Glosor</span>
              <h2 className="font-display mt-2 text-xl font-semibold">
                {list.title}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {list.pairs.filter((p) => p.term && p.translation).length} ord ·{" "}
                {list.languageFrom} → {list.languageTo}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
