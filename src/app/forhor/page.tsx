"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppData } from "@/components/useAppData";
import { SUBJECTS } from "@/lib/helpers";
import type { Subject } from "@/lib/types";

export default function ForhorLobbyPage() {
  const { data, ready } = useAppData();
  const [subject, setSubject] = useState<Subject | "Alla">("Alla");
  const [selected, setSelected] = useState<string[]>([]);

  const withMaterial = useMemo(() => {
    if (!ready) return [];
    return data.homeworks.filter(
      (h) =>
        h.extractedText.trim() ||
        h.description.trim() ||
        Boolean(h.photoDataUrl) ||
        Boolean(h.pdfDataUrl),
    );
  }, [data.homeworks, ready]);

  const filtered = useMemo(() => {
    if (subject === "Alla") return withMaterial;
    return withMaterial.filter((h) => h.subject === subject);
  }, [withMaterial, subject]);

  const recent = ready ? data.quizSessions.slice(0, 5) : [];

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleAllFiltered = () => {
    const ids = filtered.map((h) => h.id);
    const allOn = ids.every((id) => selected.includes(id));
    if (allOn) {
      setSelected((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  const startHref =
    selected.length === 1
      ? `/forhor/start?homework=${selected[0]}`
      : selected.length > 1
        ? `/forhor/start?homeworks=${selected.join(",")}`
        : null;

  if (!ready) return <p className="text-muted">Laddar…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Förhörsrummet
        </h1>
        <p className="mt-2 max-w-lg text-ink-soft">
          Välj en eller flera sparade läxor — Buddie (OpenAI) ställer frågor
          utifrån materialet. Du får tips, inte facit.
        </p>
      </div>

      <Link
        href="/glosor"
        className="panel panel-tint-coral flex items-center justify-between gap-3 p-5 transition hover:-translate-y-0.5"
      >
        <div>
          <p className="tag bg-white/80 text-coral">Glosor</p>
          <h2 className="font-display mt-2 text-xl font-semibold">
            Glosförhör
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Skapa gloslistor och träna ord — fram och tillbaka mellan språken.
          </p>
        </div>
        <span className="text-coral">→</span>
      </Link>

      <div className="panel border-[var(--line)] bg-sage-soft/40 px-5 py-4">
        <p className="text-sm leading-relaxed text-sage">
          Tipset: filtrera på ämne, bocka i läxorna du vill träna, och starta ett
          stort förhör.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-medium">Välj läxor</h2>
            <p className="mt-1 text-sm text-muted">
              {selected.length === 0
                ? "Inga valda ännu"
                : `${selected.length} läxa${selected.length > 1 ? "or" : ""} vald${selected.length > 1 ? "a" : ""}`}
            </p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted">Ämne</span>
            <select
              className="input-field min-w-[10rem]"
              value={subject}
              onChange={(e) =>
                setSubject(e.target.value as Subject | "Alla")
              }
            >
              <option value="Alla">Alla ämnen</option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {withMaterial.length === 0 ? (
          <div className="panel px-6 py-8 text-center">
            <p className="text-muted">Lägg in en läxa först — den sparas och syns här.</p>
            <Link href="/laxor/ny" className="btn-primary mt-3 inline-flex">
              Ny läxa
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel px-6 py-8 text-center">
            <p className="text-muted">Inga läxor i det ämnet ännu.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={toggleAllFiltered}
              >
                {filtered.every((h) => selected.includes(h.id))
                  ? "Avmarkera synliga"
                  : "Markera synliga"}
              </button>
              {startHref ? (
                <Link href={startHref} className="btn-primary text-sm">
                  Starta förhör ({selected.length})
                </Link>
              ) : (
                <button type="button" className="btn-primary text-sm" disabled>
                  Välj minst en läxa
                </button>
              )}
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
              {filtered.map((hw) => {
                const checked = selected.includes(hw.id);
                return (
                  <li key={hw.id}>
                    <label
                      className={`panel flex cursor-pointer gap-3 p-4 transition hover:-translate-y-0.5 ${
                        checked ? "ring-2 ring-sage/40" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-[var(--sage)]"
                        checked={checked}
                        onChange={() => toggle(hw.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="tag">{hw.subject}</span>
                        <span className="font-display mt-2 block text-lg font-medium">
                          {hw.title}
                        </span>
                        <span className="mt-1 block text-xs text-muted">
                          Klar senast {hw.dueDate}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            {startHref && (
              <div className="sticky bottom-4 z-10 flex justify-center sm:hidden">
                <Link href={startHref} className="btn-primary shadow-lg">
                  Starta förhör ({selected.length})
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="font-display mb-3 text-xl font-medium">Senaste</h2>
          <ul className="panel divide-y divide-[var(--line)]">
            {recent.map((q) => (
              <li
                key={q.id}
                className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm"
              >
                <div>
                  <p className="font-medium">{q.title}</p>
                  <p className="text-muted">
                    {q.finishedAt
                      ? `Klart — ${q.scorePercent ?? 0}%`
                      : "Pågående"}
                  </p>
                </div>
                <Link
                  href={`/forhor/${q.id}`}
                  className="text-sage hover:underline"
                >
                  Öppna
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
