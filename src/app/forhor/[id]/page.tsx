"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { notifyDataChanged, useAppData } from "@/components/useAppData";
import { gradeAnswer, gradeVocabAnswer, rewriteQuestion } from "@/lib/ai-quiz";
import { loadData, upsertQuiz } from "@/lib/store";
import type { QuizSession } from "@/lib/types";

type ChatMsg = {
  id: string;
  role: "ai" | "user";
  text: string;
  tone?: "ok" | "try" | "pep";
};

function mid() {
  return crypto.randomUUID();
}

const pepCorrect = [
  "Snyggt jobbat — du har det!",
  "Ja! Bra tänkt.",
  "Klockrent. Fortsätt så.",
  "Yes! Du är inne på rätt spår.",
];

const pepWrong = [
  "Ingen fara — så här lär man sig.",
  "Bra försök! Vi tar det igen, lugnt.",
  "Nästan. Du är närmare än du tror.",
  "Helt okej att missa. Vi kör vidare.",
];

const pepNext = [
  "Här kommer nästa:",
  "Då kör vi vidare:",
  "Nästa fråga till dig:",
  "Okej, lyssna här:",
];

function pick(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isAi = msg.role === "ai";
  return (
    <div
      className={`flex gap-2 ${isAi ? "items-end" : "flex-row-reverse items-end"}`}
    >
      {isAi && (
        <div className="relative h-8 w-8 shrink-0 overflow-hidden">
          <Image
            src="/logo-mark.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-auto"
          />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isAi
            ? msg.tone === "ok"
              ? "rounded-bl-md bg-sage-soft text-ink"
              : msg.tone === "try"
                ? "rounded-bl-md bg-brass-soft text-ink"
                : "rounded-bl-md bg-white text-ink shadow-sm ring-1 ring-[var(--line)]"
            : "rounded-br-md bg-sky text-white"
        }`}
      >
        {msg.text}
      </div>
    </div>
  );
}

export default function ForhorSessionPage() {
  const { id } = useParams<{ id: string }>();
  const { data, ready, refresh } = useAppData();
  const session = data.quizSessions.find((q) => q.id === id);

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<"ask" | "feedback" | "done">("ask");
  const [lastCorrect, setLastCorrect] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [booted, setBooted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hw = useMemo(() => {
    if (!session) return undefined;
    return data.homeworks.find((h) => h.id === session.homeworkIds[0]);
  }, [session, data.homeworks]);

  // Starta chatten en gång
  useEffect(() => {
    if (!session || booted || session.finishedAt) return;
    const q0 = session.questions[0];
    const intro =
      session.mode === "vocab"
        ? `Hej! Jag är din pluggkompis. Vi kör glosförhör: “${session.title.replace(/^Glosförhör:\s*/, "")}”. Jag ställer frågor — du svarar. Jag ger aldrig facit, bara pepp och tips.`
        : `Hej! Jag är din pluggkompis. Jag har läst ditt uppladdade material och hittat på frågor utifrån det. Svara med egna ord — jag säger om det är rätt eller fel, men jag ger aldrig facit.`;
    setMessages([
      { id: mid(), role: "ai", text: intro, tone: "pep" },
      {
        id: mid(),
        role: "ai",
        text: q0
          ? `${pick(pepNext)} ${q0.prompt}`
          : "Hmm, jag hittar inga frågor just nu.",
      },
    ]);
    setBooted(true);
  }, [session, booted]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  useEffect(() => {
    if (phase === "ask") inputRef.current?.focus();
  }, [phase, index]);

  if (!ready) return <p className="text-muted">Laddar…</p>;
  if (!session) {
    return (
      <div className="panel p-6">
        <p>Förhöret hittades inte.</p>
        <Link href="/forhor" className="btn-secondary mt-3 inline-flex">
          Tillbaka
        </Link>
      </div>
    );
  }

  const finished = Boolean(session.finishedAt) || phase === "done";
  const question = session.questions[index];
  const progress = Math.round(
    (session.answers.length / Math.max(session.questions.length, 1)) * 100,
  );

  const persist = (next: QuizSession) => {
    upsertQuiz(next);
    notifyDataChanged();
    refresh();
  };

  const pushAi = (text: string, tone?: ChatMsg["tone"]) => {
    setMessages((m) => [...m, { id: mid(), role: "ai", text, tone }]);
  };

  const submitAnswer = async () => {
    if (!question || finished || phase !== "ask") return;
    const text = answer.trim();
    if (!text) return;

    setPhase("feedback");
    setMessages((m) => [...m, { id: mid(), role: "user", text }]);
    setAnswer("");

    let result = { correct: false, feedback: "…" };
    try {
      const res = await fetch("/api/quiz/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: question.prompt,
          expectedAnswer: question.expectedAnswer,
          userAnswer: text,
          tip: question.tip,
          mode: session.mode,
        }),
      });
      if (res.ok) {
        result = await res.json();
      } else {
        result =
          session.mode === "vocab"
            ? gradeVocabAnswer(text, question.expectedAnswer)
            : gradeAnswer(text, question.expectedAnswer);
      }
    } catch {
      result =
        session.mode === "vocab"
          ? gradeVocabAnswer(text, question.expectedAnswer)
          : gradeAnswer(text, question.expectedAnswer);
    }

    setMessages((m) => [
      ...m,
      {
        id: mid(),
        role: "ai",
        text: result.correct
          ? `${pick(pepCorrect)} ${result.feedback}`
          : `${pick(pepWrong)} ${result.feedback}${
              question.tip ? `\n\n💡 ${question.tip}` : ""
            }`,
        tone: result.correct ? "ok" : "try",
      },
    ]);

    const current = loadData().quizSessions.find((q) => q.id === id) || session;
    persist({
      ...current,
      answers: [
        ...current.answers,
        {
          questionId: question.id,
          userAnswer: text,
          correct: result.correct,
          feedback: result.feedback,
        },
      ],
    });

    setLastCorrect(result.correct);
  };

  const goNext = (opts?: { rewrite?: boolean }) => {
    const current = loadData().quizSessions.find((q) => q.id === id) || session;
    let questions = [...current.questions];

    if (opts?.rewrite && question && !lastCorrect) {
      const rewritten = rewriteQuestion(question, hw);
      questions = [
        ...questions.slice(0, index + 1),
        rewritten,
        ...questions.slice(index + 1),
      ];
      pushAi(
        `Okej, vi tar samma sak på ett annat sätt:\n\n${rewritten.prompt}`,
      );
      persist({ ...current, questions });
      setIndex(index + 1);
      setAnswer("");
      setPhase("ask");
      return;
    }

    const nextIndex = index + 1;
    const done = nextIndex >= questions.length;

    if (done) {
      const correctCount = current.answers.filter((a) => a.correct).length;
      const scorePercent = Math.round(
        (correctCount / Math.max(current.answers.length, 1)) * 100,
      );
      const failed = current.answers.length - correctCount;
      persist({
        ...current,
        questions,
        finishedAt: new Date().toISOString(),
        scorePercent,
      });
      pushAi(
        failed === 0
          ? `Förhöret är klart! Du fick ${scorePercent}%. Grymt jobbat — du har greppet.`
          : `Förhöret är klart! Du fick ${scorePercent}%. Du missade ${failed} frågor — helt okej. Vill du träna om dem?`,
        "pep",
      );
      setPhase("done");
      return;
    }

    const nextQ = questions[nextIndex];
    pushAi(`${pick(pepNext)} ${nextQ.prompt}`);
    persist({ ...current, questions });
    setIndex(nextIndex);
    setAnswer("");
    setPhase("ask");
  };

  const startRetry = () => {
    const current = loadData().quizSessions.find((q) => q.id === id) || session;
    const failedIds = new Set(
      current.answers.filter((a) => !a.correct).map((a) => a.questionId),
    );
    const base = current.questions.filter((q) => failedIds.has(q.id));
    const retryQs = base.map((q) => rewriteQuestion(q, hw));
    const retry: QuizSession = {
      id: crypto.randomUUID(),
      homeworkIds: current.homeworkIds,
      vocabListId: current.vocabListId,
      mode: current.mode === "vocab" ? "vocab" : "retry",
      title: `Omträning: ${current.title}`,
      questions: retryQs,
      answers: [],
      startedAt: new Date().toISOString(),
    };
    upsertQuiz(retry);
    notifyDataChanged();
    window.location.href = `/forhor/${retry.id}`;
  };

  const latest = loadData().quizSessions.find((q) => q.id === id) || session;
  const failedCount = latest.answers.filter((a) => !a.correct).length;

  return (
    <div className="mx-auto flex h-[min(720px,calc(100vh-8rem))] max-w-lg flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link href="/forhor" className="text-sm text-muted hover:text-ink">
          ← Rummet
        </Link>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span>
            {Math.min(session.answers.length + (phase === "ask" ? 1 : 0), session.questions.length)}{" "}
            / {session.questions.length}
          </span>
        </div>
      </div>

      <div className="mb-2 h-1 overflow-hidden rounded-full bg-[var(--line)]">
        <div
          className="h-full bg-sage transition-all duration-300"
          style={{ width: `${finished ? 100 : progress}%` }}
        />
      </div>

      <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
          <Image
            src="/logo-mark.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-auto"
          />
          <div>
            <p className="text-sm font-semibold">Buddie</p>
            <p className="text-xs text-muted">Förhörschatt · ingen facit</p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[var(--line)] bg-white/50 p-3">
          {phase === "ask" && !finished && (
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                className="input-field min-h-[44px] flex-1 resize-none py-2.5"
                rows={1}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitAnswer();
                  }
                }}
                placeholder="Skriv ditt svar…"
              />
              <button
                type="button"
                className="btn-primary shrink-0 self-end"
                onClick={submitAnswer}
                disabled={!answer.trim()}
              >
                Skicka
              </button>
            </div>
          )}

          {phase === "feedback" && !finished && (
            <div className="flex flex-wrap gap-2">
              {!lastCorrect && (
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => goNext({ rewrite: true })}
                >
                  Fråga på annat sätt
                </button>
              )}
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => goNext()}
              >
                Nästa fråga
              </button>
            </div>
          )}

          {finished && (
            <div className="flex flex-wrap gap-2">
              {failedCount > 0 && (
                <button type="button" className="btn-primary text-sm" onClick={startRetry}>
                  Träna det jag missade
                </button>
              )}
              <Link href="/forhor" className="btn-secondary text-sm">
                Till förhörsrummet
              </Link>
              {session.mode === "vocab" && session.vocabListId && (
                <Link
                  href={`/glosor/${session.vocabListId}`}
                  className="btn-ghost text-sm"
                >
                  Till gloslistan
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
