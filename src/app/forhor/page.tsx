"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppData } from "@/components/useAppData";
import { SUBJECTS, hasHomeworkFiles } from "@/lib/helpers";
import type { Subject } from "@/lib/types";
import { homeworkPractice } from "@/lib/practice";

export default function ForhorLobbyPage() {
  const { data, ready } = useAppData();
  const [subject, setSubject] = useState<Subject | "Alla">("Alla");
  const [selected, setSelected] = useState<string[]>([]);

  const allHomework = useMemo(() => {
    if (!ready) return [];
    return data.homeworks;
  }, [data.homeworks, ready]);

  const filtered = useMemo(() => {
    if (subject === "Alla") return allHomework;
    return allHomework.filter((h) => h.subject === subject);
  }, [allHomework, subject]);

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
          Träna läxan
        </h1>
        <p className="mt-2 max-w-lg text-ink-soft">
          Välj läxa och träna på ditt sätt: chatta med Buddie, skriv ett prov
          eller svara högt med frågekort (flashcards). Följ din träning under varje läxa.
        </p>
        <Link href="/laxor/ny" className="btn-primary mt-4 inline-flex">+ Lägg till ny läxa</Link>
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
          Börja med en läxa nedanför. Välj hur du vill träna på läxans knappar.
          Vill du träna flera läxor tillsammans? Kryssa i dem och tryck på Träna valda läxor.
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

        {allHomework.length === 0 ? (
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
                  ? "Ta bort alla val"
                  : "Välj alla som visas"}
              </button>
              {startHref ? (
                <Link href={startHref} className="btn-primary text-sm">
                  Träna valda läxor ({selected.length})
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
                const hasFile = hasHomeworkFiles(hw);
                const stats = homeworkPractice(data.quizSessions, hw.id);
                return (
                  <li key={hw.id} className="panel overflow-hidden">
                    <label
                      className={`flex cursor-pointer gap-3 p-4 transition ${
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
                        <span className="flex flex-wrap gap-1.5">
                          <span className="tag">{hw.subject}</span>
                          {hw.recurringWeekly && (
                            <span className="tag bg-sky-soft text-sky">
                              Varje vecka
                            </span>
                          )}
                          {!hasFile && (
                            <span className="tag bg-brass-soft/60 text-brass">
                              Fil saknas
                            </span>
                          )}
                        </span>
                        <span className="font-display mt-2 block text-lg font-medium">
                          {hw.title}
                        </span>
                        <span className="mt-1 block text-xs text-muted">
                          Klar senast {hw.dueDate}
                          {!hasFile ? " · ladda upp vid start" : ""}
                        </span>
                      </span>
                    </label>
                    <div className="space-y-3 border-t border-[var(--line)] p-4">
                      <p className="text-sm text-muted">{stats.sessions} träningspass · {stats.answered} besvarade frågor · {stats.percent === null ? "Inget resultat ännu" : `${stats.percent}% rätt totalt`}</p>
                      <p className="text-sm text-ink-soft">Chatta en fråga i taget, skriv ett övningsprov eller vänd frågekort och svara högt.</p>
                      <div className="flex flex-wrap gap-2">
                        <Link className="btn-primary text-sm" href={`/forhor/start?homework=${hw.id}`}>Chatta med Buddie</Link>
                        <Link className="btn-secondary text-sm" href={`/forhor/start?homework=${hw.id}&format=exam`}>Gör övningsprov</Link>
                        <Link className="btn-secondary text-sm" href={`/forhor/start?homework=${hw.id}&format=flashcards`}>Frågekort</Link>
                      </div>
                      <details className="rounded-xl bg-sage-soft/40 p-3">
                        <summary className="cursor-pointer text-sm font-medium text-sage">ⓘ Min träning & tips</summary>
                        <div className="mt-3 space-y-3 text-sm">
                          <p>{stats.completed} avslutade pass. På frågekorten väljer du själv om du kunde svaret.</p>
                          {stats.weakQuestions.length ? <>
                            <p>Det här behövde du hjälp med senast:</p>
                            <ul className="list-inside list-disc">{stats.weakQuestions.map(q => <li key={q.id}>{q.topic || q.prompt}</li>)}</ul>
                            <Link className="btn-primary inline-flex text-sm" href={`/forhor/start?homework=${hw.id}&focus=weak`}>Förhör mig på detta</Link>
                          </> : <p>{stats.answered ? "Inga särskilda svårigheter i dina senaste svar. Repetera gärna med ett nytt pass." : "Träna en första gång så får du tips utifrån dina svar."}</p>}
                          <Link className="block text-sage underline" href={`/laxor/${hw.id}`}>Visa eller ändra läxan</Link>
                        </div>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ul>

            {startHref && (
              <div className="sticky bottom-4 z-10 flex justify-center sm:hidden">
                <Link href={startHref} className="btn-primary shadow-lg">
                  Träna valda läxor ({selected.length})
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="font-display mb-3 text-xl font-medium">Din senaste träning</h2>
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
