"use client";

import { useState } from "react";
import { notifyDataChanged, useAppData } from "@/components/useAppData";
import { SUBJECTS, weakTopicsFromResults } from "@/lib/helpers";
import { upsertExam } from "@/lib/store";
import type { ExamResult, Subject } from "@/lib/types";

export default function ResultatPage() {
  const { data, ready, refresh } = useAppData();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<Subject>("Matematik");
  const [date, setDate] = useState("");
  const [scorePercent, setScorePercent] = useState(70);
  const [reflection, setReflection] = useState("");
  const [weakTopics, setWeakTopics] = useState("");

  if (!ready) return <p className="text-muted">Laddar…</p>;

  const weak = weakTopicsFromResults(data.examResults, data.quizSessions);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    const result: ExamResult = {
      id: crypto.randomUUID(),
      title: title.trim(),
      subject,
      date,
      scorePercent,
      reflection: reflection.trim(),
      weakTopics: weakTopics
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      relatedHomeworkIds: [],
      createdAt: new Date().toISOString(),
    };
    upsertExam(result);
    notifyDataChanged();
    refresh();
    setTitle("");
    setReflection("");
    setWeakTopics("");
    setScorePercent(70);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Resultat
        </h1>
        <p className="mt-2 max-w-lg text-ink-soft">
          Fyll i hur det gick på provet — så ser du vad du behöver träna mer.
        </p>
      </div>

      {weak.length > 0 && (
        <section className="panel px-5 py-5 sm:px-6">
          <h2 className="font-display text-xl font-medium">Fokusområden</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {weak.map((w) => (
              <span
                key={w.topic}
                className="rounded-full border border-[var(--line-strong)] bg-white/60 px-3 py-1.5 text-sm"
              >
                {w.topic}
              </span>
            ))}
          </div>
        </section>
      )}

      <form onSubmit={save} className="panel space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-xl font-medium">Hur gick provet?</h2>
        <div>
          <label className="label">Provets namn</label>
          <input
            className="input-field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="T.ex. Matteprov bråk"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Ämne</label>
            <select
              className="input-field"
              value={subject}
              onChange={(e) => setSubject(e.target.value as Subject)}
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Datum</label>
            <input
              type="date"
              className="input-field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Resultat: {scorePercent}%</label>
          <input
            type="range"
            min={0}
            max={100}
            value={scorePercent}
            onChange={(e) => setScorePercent(Number(e.target.value))}
            className="w-full accent-[var(--sage)]"
          />
        </div>
        <div>
          <label className="label">Vad gick mindre bra?</label>
          <input
            className="input-field"
            value={weakTopics}
            onChange={(e) => setWeakTopics(e.target.value)}
            placeholder="bråk, ekvationer (kommaseparerat)"
          />
        </div>
        <div>
          <label className="label">Reflektion</label>
          <textarea
            className="input-field min-h-24"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="Vad vill du göra annorlunda nästa gång?"
          />
        </div>
        <button type="submit" className="btn-primary">
          Spara resultat
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-medium">Tidigare</h2>
        {data.examResults.length === 0 ? (
          <p className="text-sm text-muted">Inga prov ifyllda ännu.</p>
        ) : (
          data.examResults.map((r) => (
            <article key={r.id} className="panel p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tag">{r.subject}</span>
                <span className="text-xs text-muted">{r.date}</span>
              </div>
              <h3 className="font-display mt-2 text-xl font-medium">{r.title}</h3>
              <p className="mt-1 font-display text-3xl text-sage">
                {r.scorePercent}%
              </p>
              {r.weakTopics.length > 0 && (
                <p className="mt-2 text-sm text-muted">
                  Plugga mer: {r.weakTopics.join(", ")}
                </p>
              )}
              {r.reflection && (
                <p className="mt-1 text-sm text-ink-soft">{r.reflection}</p>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
