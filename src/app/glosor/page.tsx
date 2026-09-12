"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { notifyDataChanged, useAppData } from "@/components/useAppData";
import { parseVocabPaste } from "@/lib/ai-quiz";
import {
  compressImageToDataUrl,
  extractTextFromPdf,
  readFileAsDataUrl,
} from "@/lib/pdf";
import { upsertVocabList } from "@/lib/store";
import type { VocabList, VocabPair } from "@/lib/types";

export default function GlosorPage() {
  const { data, ready, refresh } = useAppData();
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [languageFrom, setLanguageFrom] = useState("engelska");
  const [languageTo, setLanguageTo] = useState("svenska");
  const [paste, setPaste] = useState("");
  const [imported, setImported] = useState<VocabPair[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  if (!ready) return <p className="text-muted">Laddar…</p>;

  const extractFromFile = async (file: File | null, kind: "image" | "pdf") => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      let photoDataUrl: string | undefined;
      let pdfDataUrl: string | undefined;
      let pdfFileName: string | undefined;
      let extractedText = "";

      if (kind === "pdf") {
        if (file.size > 40_000_000) {
          setError("PDF:en är för stor (max ca 40 MB).");
          return;
        }
        const [dataUrl, text] = await Promise.all([
          readFileAsDataUrl(file),
          extractTextFromPdf(file).catch(() => ""),
        ]);
        pdfDataUrl = dataUrl;
        pdfFileName = file.name;
        extractedText = text;
      } else {
        if (!file.type.startsWith("image/")) {
          setError("Välj en bild.");
          return;
        }
        photoDataUrl = await compressImageToDataUrl(file);
      }

      const res = await fetch("/api/vocab/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoDataUrl,
          pdfDataUrl,
          pdfFileName,
          extractedText,
          languageFrom,
          languageTo,
        }),
      });
      const json = (await res.json()) as {
        pairs?: { term: string; translation: string }[];
        languageFrom?: string;
        languageTo?: string;
        error?: string;
      };
      if (!res.ok || !json.pairs?.length) {
        setError(json.error || "Kunde inte läsa glosorna.");
        return;
      }

      const added = json.pairs.map((p) => ({
        id: crypto.randomUUID(),
        term: p.term,
        translation: p.translation,
      }));
      setImported((prev) => [...prev, ...added]);
      if (json.languageFrom) setLanguageFrom(json.languageFrom);
      if (json.languageTo) setLanguageTo(json.languageTo);
      if (!title.trim()) {
        const base = file.name.replace(/\.[^.]+$/, "").trim();
        setTitle(base || "Ny gloslista");
      }
    } catch {
      setError("Kunde inte läsa filen. Försök igen.");
    } finally {
      setBusy(false);
    }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const fromPaste = parseVocabPaste(paste).map((p) => ({
      id: crypto.randomUUID(),
      ...p,
    }));
    const pairs = [...imported, ...fromPaste].filter(
      (p) => p.term.trim() && p.translation.trim(),
    );
    if (!title.trim() && pairs.length === 0) {
      setError("Ge listan ett namn eller ladda upp glosor.");
      return;
    }
    const now = new Date().toISOString();
    const list: VocabList = {
      id: crypto.randomUUID(),
      title: title.trim() || "Ny gloslista",
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
            Dina ord, ditt sätt att lära. Spela Memory, Ordjakten eller
            Bokstavsmix – eller chatta med Buddie. Välj en lista för att börja.
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
            <label className="label" htmlFor="vocab-title">Namn</label>
            <input id="vocab-title"
              className="input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="T.ex. Engelska kapitel 3"
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="vocab-from">Från språk</label>
              <input id="vocab-from"
                className="input-field"
                value={languageFrom}
                onChange={(e) => setLanguageFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="vocab-to">Till språk</label>
              <input id="vocab-to"
                className="input-field"
                value={languageTo}
                onChange={(e) => setLanguageTo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-xl bg-white/70 p-3">
            <p className="label mb-0">Ladda upp gloslista</p>
            <p className="text-xs text-muted">
              Ta foto, välj bild eller PDF — orden läses in direkt.
            </p>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="fixed left-[-9999px] top-0 h-px w-px opacity-0"
              onChange={(e) => {
                void extractFromFile(e.target.files?.[0] ?? null, "image");
                e.target.value = "";
              }}
            />
            <input
              ref={libraryRef}
              type="file"
              accept="image/*"
              className="fixed left-[-9999px] top-0 h-px w-px opacity-0"
              onChange={(e) => {
                void extractFromFile(e.target.files?.[0] ?? null, "image");
                e.target.value = "";
              }}
            />
            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf,.pdf"
              className="fixed left-[-9999px] top-0 h-px w-px opacity-0"
              onChange={(e) => {
                void extractFromFile(e.target.files?.[0] ?? null, "pdf");
                e.target.value = "";
              }}
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                className="btn-secondary py-2 text-sm"
                disabled={busy}
                onClick={() => cameraRef.current?.click()}
              >
                Ta foto
              </button>
              <button
                type="button"
                className="btn-secondary py-2 text-sm"
                disabled={busy}
                onClick={() => libraryRef.current?.click()}
              >
                Välj bild
              </button>
              <button
                type="button"
                className="btn-secondary py-2 text-sm"
                disabled={busy}
                onClick={() => pdfRef.current?.click()}
              >
                Välj PDF
              </button>
            </div>
            {busy && (
              <p className="text-sm text-muted">Läser gloslistan…</p>
            )}
            {imported.length > 0 && (
              <div className="rounded-lg bg-sage-soft/50 px-3 py-2 text-sm text-sage">
                {imported.length} glosor inlästa
                <button
                  type="button"
                  className="btn-ghost ml-2 text-xs"
                  onClick={() => setImported([])}
                >
                  Rensa
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="label" htmlFor="vocab-paste">Eller klistra in glosor</label>
            <textarea id="vocab-paste"
              className="input-field min-h-24 font-mono text-sm"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"apple - äpple\nbeautiful - vacker\nfriend; vän"}
            />
            <p className="mt-1 text-xs text-muted">
              En rad per glosa: ord - översättning
            </p>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button type="submit" className="btn-primary" disabled={busy}>
            Skapa lista
            {imported.length > 0 ? ` (${imported.length} glosor)` : ""}
          </button>
        </form>
      )}

      {data.vocabLists.length === 0 ? (
        <div className="panel px-6 py-10 text-center">
          <p className="text-muted">Inga gloslistor ännu.</p>
          {!showNew && (
            <button
              type="button"
              className="btn-primary mt-3"
              onClick={() => setShowNew(true)}
            >
              Ny gloslista
            </button>
          )}
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
              <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="tag bg-sage-soft text-sage">▦ Memory</span><span className="tag bg-lilac-soft text-lilac">◎ Ordjakten</span><span className="tag bg-sky-soft text-sky">Aa Bokstavsmix</span></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
