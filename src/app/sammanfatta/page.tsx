"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { notifyDataChanged, useAppData } from "@/components/useAppData";
import { inventQuestionsFromHomework } from "@/lib/invent-questions";
import { upsertQuiz } from "@/lib/store";
import type { QuizSession, Subject } from "@/lib/types";
import Link from "next/link";

export default function SammanfattaPage() {
  const { data, ready } = useAppData();
  const router = useRouter();
  const [subjectFilter, setSubjectFilter] = useState<Subject | "Alla">("Alla");
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    if (!ready) return [];
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return data.homeworks.filter((h) => {
      const okSubject = subjectFilter === "Alla" || h.subject === subjectFilter;
      const okDate = new Date(h.createdAt) >= cutoff;
      return okSubject && okDate;
    });
  }, [data.homeworks, subjectFilter, months, ready]);

  if (!ready) return <p className="text-muted">Laddar…</p>;

  const start = async () => {
    if (filtered.length === 0 || loading) return;
    setLoading(true);
    try {
      // Samla frågor från flera läxor via API (första) + lokalt för resten
      const allQuestions = [];
      for (const hw of filtered.slice(0, 6)) {
        try {
          const res = await fetch("/api/quiz/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ homework: hw, count: 2 }),
          });
          if (res.ok) {
            const json = await res.json();
            allQuestions.push(...(json.questions || []));
            continue;
          }
        } catch {
          /* local */
        }
        allQuestions.push(...inventQuestionsFromHomework(hw, 2));
      }
      for (let i = allQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
      }
      const session: QuizSession = {
        id: crypto.randomUUID(),
        homeworkIds: filtered.map((h) => h.id),
        mode: "summary",
        title: `Sammanfattning – ${subjectFilter} (${months} mån)`,
        questions: allQuestions.slice(0, 8),
        answers: [],
        startedAt: new Date().toISOString(),
      };
      upsertQuiz(session);
      notifyDataChanged();
      router.push(`/forhor/${session.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Repetera
        </h1>
        <p className="mt-2 max-w-lg text-ink-soft">
          Plugga ihop läxor över terminen inför stora prov.
        </p>
      </div>

      <div className="panel space-y-4 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Ämne</label>
            <select
              className="input-field"
              value={subjectFilter}
              onChange={(e) =>
                setSubjectFilter(e.target.value as Subject | "Alla")
              }
            >
              <option value="Alla">Alla ämnen</option>
              {[
                "Matematik",
                "Svenska",
                "Engelska",
                "NO",
                "SO",
                "Historia",
                "Annat",
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Period</label>
            <select
              className="input-field"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            >
              <option value={1}>Senaste månaden</option>
              <option value={3}>Senaste 3 månaderna</option>
              <option value={6}>Halvår</option>
              <option value={12}>Hela året</option>
            </select>
          </div>
        </div>

        <p className="text-sm text-muted">
          {filtered.length} läxor ingår
        </p>

        <ul className="max-h-48 space-y-2 overflow-auto">
          {filtered.map((h) => (
            <li key={h.id} className="flex items-center gap-2 text-sm">
              <span className="tag">{h.subject}</span>
              <Link href={`/laxor/${h.id}`} className="hover:underline">
                {h.title}
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="btn-primary"
          disabled={filtered.length === 0 || loading}
          onClick={start}
        >
          {loading ? "Skapar frågor…" : "Starta stort förhör"}
        </button>
      </div>
    </div>
  );
}
