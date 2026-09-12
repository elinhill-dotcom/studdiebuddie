"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { notifyDataChanged } from "./useAppData";
import { loadData, upsertExam, upsertQuiz } from "@/lib/store";
import type { Homework, QuizAttemptAnswer, QuizSession } from "@/lib/types";

export function PracticeSession({ session, homeworks }: { session: QuizSession; homeworks: Homework[] }) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(session.answers.map(a => [a.questionId, a.userAnswer])));
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const flash = session.mode === "flashcards";
  const completed = session.answers.filter(a => !a.pending);
  const card = session.questions.find(q => !completed.some(a => a.questionId === q.id));

  function save(answers: QuizAttemptAnswer[], done = false) {
    const next: QuizSession = { ...session, answers };
    if (done) {
      next.finishedAt = new Date().toISOString();
      next.scorePercent = Math.round(answers.filter(a => a.correct).length / Math.max(1, session.questions.length) * 100);
    }
    upsertQuiz(next);
    if (done) upsertExam({
      id: session.id, title: session.title, subject: homeworks[0]?.subject || "Annat",
      date: next.finishedAt!.slice(0, 10), scorePercent: next.scorePercent!,
      reflection: flash ? "Flashcards – egen bedömning" : "Skriftligt övningsprov",
      weakTopics: session.questions.filter(q => answers.some(a => a.questionId === q.id && !a.correct)).map(q => q.topic || q.prompt),
      relatedHomeworkIds: session.homeworkIds, createdAt: next.finishedAt!,
    });
    notifyDataChanged();
  }

  function markCard(correct: boolean) {
    if (!card || !revealed || locked.current) return;
    locked.current = true;
    const answers = [...completed, { questionId: card.id, userAnswer: correct ? "Kunde svaret muntligt" : "Behöver träna mer", correct, needsPractice: !correct }];
    save(answers, answers.length === session.questions.length);
    setRevealed(false);
    locked.current = false;
  }

  async function submitExam() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    const answers: QuizAttemptAnswer[] = [];
    try {
      for (const question of session.questions) {
        const userAnswer = drafts[question.id]?.trim() || "";
        if (!userAnswer) {
          answers.push({ questionId: question.id, userAnswer: "", correct: false, feedback: "Obesvarad fråga." });
          continue;
        }
        const hw = homeworks.find(h => h.id === question.homeworkId) || homeworks[0];
        const response = await fetch("/api/quiz/grade", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(45000),
          body: JSON.stringify({ prompt: question.prompt, expectedAnswer: question.expectedAnswer, userAnswer, subject: hw?.subject, material: hw?.extractedText || hw?.description, attemptCount: 1 }),
        });
        if (!response.ok) throw new Error("grade");
        const result = await response.json();
        if (result.evaluation === "not_assessable") throw new Error("unassessable");
        answers.push({ questionId: question.id, userAnswer, correct: result.correct === true, feedback: result.feedback, needsPractice: !result.correct });
      }
      save(answers, true);
    } catch {
      setError("Rättningen kunde inte slutföras. Dina svar är sparade. Försök lämna in igen.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  const base = `/forhor/start?homeworks=${session.homeworkIds.join(",")}&format=${session.mode}`;
  return <div className="mx-auto max-w-2xl space-y-5">
    <Link href="/forhor" className="text-sm text-muted">← Förhörsrummet</Link>
    <div>
      <p className="tag">{flash ? "Flashcards · muntlig träning" : "Skriftligt övningsprov"}</p>
      <h1 className="font-display mt-3 text-3xl">{session.title.replace(/^Förhör: /, "")}</h1>
      <p className="mt-2 text-muted">{flash ? "Svara högt själv eller tillsammans med någon. Vänd kortet och bedöm hur det gick." : "Svara i din egen takt. Du får återkoppling och svarsförslag när du lämnar in."}</p>
      <p className="mt-2 text-sm text-muted">{session.questions.length} {flash ? "kort" : "frågor"} i detta pass. <Link className="text-sage underline" href={base}>Skapa nytt från hela läxan</Link></p>
    </div>
    {session.finishedAt ? <>
      <div className="panel space-y-3 bg-sage-soft/40 p-6">
        <h2 className="font-display text-2xl">Klart! {session.scorePercent}% {flash ? "kunde du själv" : "rätt"}</h2>
        <p>{completed.filter(a => a.correct).length} av {session.questions.length} frågor. {flash && "Resultatet bygger på din egen bedömning."}</p>
        <div className="flex flex-wrap gap-2">
          {completed.some(a => !a.correct) && <Link className="btn-primary" href={`${base}&focus=weak`}>Träna det jag missade</Link>}
          <Link className="btn-secondary" href={base}>Nytt pass</Link>
          <Link className="btn-ghost" href="/forhor">Till mina läxor</Link>
        </div>
      </div>
      {session.questions.map(q => {
        const a = completed.find(a => a.questionId === q.id);
        return <div key={q.id} className="panel space-y-2 p-5">
          <p className="text-sm font-medium text-sage">{a?.correct ? "✓ Kunde" : "Träna mer"}</p>
          <h3 className="font-medium">{q.prompt}</h3>
          {!flash && <p className="whitespace-pre-wrap text-sm">Ditt svar: {a?.userAnswer || "Inget svar"}</p>}
          <p className="whitespace-pre-wrap rounded-xl bg-sage-soft/40 p-3 text-sm">Svarsförslag: {q.expectedAnswer}</p>
        </div>;
      })}
    </> : flash ? card ? <div className="panel space-y-6 p-6 sm:p-10">
      <p className="text-sm text-muted">Kort {completed.length + 1} av {session.questions.length}</p>
      <h2 className="font-display text-2xl leading-relaxed">{card.prompt}</h2>
      {revealed ? <>
        <div className="whitespace-pre-wrap rounded-xl bg-sage-soft/50 p-5">{card.expectedAnswer}</div>
        <p className="text-sm text-muted">Hur gick det innan du såg svaret?</p>
        <div className="flex flex-wrap gap-3">
          <button className="btn-secondary" onClick={() => markCard(false)}>Träna mer</button>
          <button className="btn-primary" onClick={() => markCard(true)}>Det kunde jag</button>
        </div>
      </> : <button className="btn-primary" onClick={() => setRevealed(true)}>Vänd kortet · visa svar</button>}
    </div> : <p>Inga kort kvar.</p> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); void submitExam(); }}>
      {session.questions.map((q, index) => <div key={q.id} className="panel space-y-3 p-5">
        <label htmlFor={q.id} className="block font-medium">{index + 1}. {q.prompt}</label>
        <textarea id={q.id} className="input-field min-h-32" disabled={busy} value={drafts[q.id] || ""} placeholder="Skriv ditt svar med egna ord…" onChange={e => {
          const next = { ...drafts, [q.id]: e.target.value };
          setDrafts(next);
        }} onBlur={() => {
          if (busy) return;
          const current = loadData().quizSessions.find(s => s.id === session.id);
          if (current?.finishedAt) return;
          save(session.questions.filter(q => drafts[q.id]?.trim()).map(q => ({ questionId: q.id, userAnswer: drafts[q.id], correct: false, pending: true })));
        }} />
      </div>)}
      <p className="text-sm text-muted">{session.questions.filter(q => drafts[q.id]?.trim()).length} av {session.questions.length} besvarade. Tomma svar räknas som obesvarade.</p>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <button className="btn-primary" disabled={busy || !Object.values(drafts).some(v => v.trim())}>{busy ? "Rättar ditt prov…" : "Lämna in prov"}</button>
    </form>}
  </div>;
}
