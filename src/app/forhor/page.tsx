"use client";

import Link from "next/link";
import { useAppData } from "@/components/useAppData";

export default function ForhorLobbyPage() {
  const { data, ready } = useAppData();
  if (!ready) return <p className="text-muted">Laddar…</p>;

  const withMaterial = data.homeworks.filter(
    (h) => h.extractedText.trim() || h.description.trim(),
  );
  const recent = data.quizSessions.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Förhörsrummet
        </h1>
        <p className="mt-2 max-w-lg text-ink-soft">
          Här ställs frågor utifrån dina läxor och glosor. Du får aldrig facit
          under förhöret — bara tips och nya frågor om det behövs.
        </p>
      </div>

      <Link
        href="/glosor"
        className="panel panel-tint-coral flex items-center justify-between gap-3 p-5 transition hover:-translate-y-0.5"
      >
        <div>
          <p className="tag bg-white/80 text-coral">Nytt</p>
          <h2 className="font-display mt-2 text-xl font-semibold">Glosförhör</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Skapa gloslistor och träna ord — fram och tillbaka mellan språken.
          </p>
        </div>
        <span className="text-coral">→</span>
      </Link>

      <div className="panel border-[var(--line)] bg-sage-soft/40 px-5 py-4">
        <p className="text-sm leading-relaxed text-sage">
          Regler: frågor, inte svar. Missar du en fråga kan den skrivas om, och
          tipset kan peka till sidan i häftet eller gloslistan.
        </p>
      </div>

      <section>
        <h2 className="font-display mb-3 text-xl font-medium">Välj läxa</h2>
        {withMaterial.length === 0 ? (
          <div className="panel px-6 py-8 text-center">
            <p className="text-muted">Lägg in en läxa först.</p>
            <Link href="/laxor/ny" className="btn-primary mt-3 inline-flex">
              Ny läxa
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {withMaterial.map((hw) => (
              <div key={hw.id} className="panel p-5">
                <span className="tag">{hw.subject}</span>
                <h3 className="font-display mt-2 text-xl font-medium">
                  {hw.title}
                </h3>
                <Link
                  href={`/forhor/start?homework=${hw.id}`}
                  className="btn-secondary mt-4 inline-flex text-sm"
                >
                  Starta förhör
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <Link href="/sammanfatta" className="text-sm text-muted hover:text-ink">
        Eller plugga sammanfattande över flera läxor →
      </Link>

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
