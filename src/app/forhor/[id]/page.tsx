"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { notifyDataChanged, useAppData } from "@/components/useAppData";
import { gradeAnswer, gradeVocabAnswer, rewriteQuestion } from "@/lib/ai-quiz";
import { loadData, upsertQuiz } from "@/lib/store";
import type { Homework, QuizSession } from "@/lib/types";
import {
  tutorLangFromSubject,
  tutorLangFromSubjects,
  type TutorLang,
} from "@/lib/tutor-lang";

type ChatMsg = {
  id: string;
  role: "ai" | "user";
  text: string;
  tone?: "ok" | "try" | "pep";
};

type GradeResult = {
  correct: boolean;
  feedback: string;
  next_action?: string;
  evaluation?: string;
};

function mid() {
  return crypto.randomUUID();
}

const bridgeByLang: Record<TutorLang, string[]> = {
  sv: [
    "Då tar vi en annan grej från materialet:",
    "Nice — vad säger du om det här då?",
    "Okej, lyssna här…",
    "En sak till jag undrar:",
  ],
  en: [
    "Let's look at another part of the material:",
    "Nice — what about this then?",
    "Okay, check this out…",
    "One more thing I'm curious about:",
  ],
  es: [
    "Ahora otra cosa del material:",
    "Genial — ¿y esto?",
    "Vale, mira…",
    "Una cosa más:",
  ],
  de: [
    "Dann schauen wir uns noch etwas anderes an:",
    "Super — und was ist damit?",
    "Okay, hör mal…",
    "Noch etwas, das mich interessiert:",
  ],
};

function pick(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function introFor(
  lang: TutorLang,
  opts: { vocab: boolean; multi: boolean; n: number; title: string; firstQ: string },
) {
  const name = opts.title.replace(/^Glosförhör:\s*/, "");
  if (opts.vocab) {
    if (lang === "en")
      return `Hi! I'm your study buddy. We'll chat through the vocab in “${name}” — like a real conversation. I won't give the answer key, just tips and pep.\n\n${opts.firstQ}`;
    if (lang === "es")
      return `¡Hola! Soy tu compañero de estudio. Hablaremos del vocabulario de “${name}” como una conversación. No doy la respuesta directa, solo pistas y ánimo.\n\n${opts.firstQ}`;
    if (lang === "de")
      return `Hallo! Ich bin dein Lernbuddy. Wir sprechen über die Vokabeln in „${name}“ — wie ein echtes Gespräch. Ich gebe keine direkte Lösung, nur Tipps und Mut.\n\n${opts.firstQ}`;
    return `Hej! Jag är din pluggkompis. Vi snackar oss igenom glosorna i “${name}” — som ett vanligt samtal. Jag ger aldrig facit, bara tips och pepp.\n\n${opts.firstQ}`;
  }
  if (opts.multi) {
    if (lang === "en")
      return `Hi! I've read ${opts.n} of your homework assignments. Let's talk them through together — you answer in your own words, I guide you. No answer key.\n\n${opts.firstQ}`;
    if (lang === "es")
      return `¡Hola! He leído ${opts.n} deberes. Hablemos de ellos juntos — tú respondes con tus palabras, yo te guío. Sin respuesta directa.\n\n${opts.firstQ}`;
    if (lang === "de")
      return `Hallo! Ich habe ${opts.n} Hausaufgaben gelesen. Lass uns darüber reden — du antwortest mit eigenen Worten, ich helfe. Keine direkte Lösung.\n\n${opts.firstQ}`;
    return `Hej! Jag har läst ${opts.n} av dina läxor. Vi pratar igenom dem tillsammans — du svarar med egna ord, jag vägleder. Ingen facit.\n\n${opts.firstQ}`;
  }
  if (lang === "en")
    return `Hi! I've read your material. Let's learn through a conversation — answer in your own words and I'll guide you. I never give the answer key.\n\n${opts.firstQ}`;
  if (lang === "es")
    return `¡Hola! He leído tu material. Aprendamos hablando — responde con tus palabras y te guío. Nunca doy la respuesta directa.\n\n${opts.firstQ}`;
  if (lang === "de")
    return `Hallo! Ich habe dein Material gelesen. Wir lernen im Gespräch — antworte mit eigenen Worten, ich helfe. Keine direkte Lösung.\n\n${opts.firstQ}`;
  return `Hej! Jag har läst ditt material. Vi lär oss genom att prata — svara med egna ord så vägleder jag dig. Jag ger aldrig facit.\n\n${opts.firstQ}`;
}

function doneMsg(lang: TutorLang, scorePercent: number, failed: number) {
  if (lang === "en") {
    return failed === 0
      ? `That was a solid chat — you really got this (${scorePercent}%). Great work!`
      : `Nice conversation! You landed around ${scorePercent}%. A few bits were tricky — want to practise those?`;
  }
  if (lang === "es") {
    return failed === 0
      ? `¡Buena conversación! Lo tienes claro (${scorePercent}%). ¡Bien hecho!`
      : `¡Buena charla! Alrededor de ${scorePercent}%. Algunas partes fueron más difíciles — ¿las practicamos?`;
  }
  if (lang === "de") {
    return failed === 0
      ? `Gutes Gespräch — du hast das drauf (${scorePercent}%). Super!`
      : `Schönes Gespräch! Etwa ${scorePercent}%. Ein paar Stellen waren knifflig — wollen wir die üben?`;
  }
  return failed === 0
    ? `Vad fint samtal — du har greppet (${scorePercent}%). Grymt jobbat!`
    : `Bra snack! Du landade runt ${scorePercent}%. Några bitar var kluriga — vill du träna dem?`;
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
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
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
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [booted, setBooted] = useState(false);
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const linkedHomeworks = useMemo(() => {
    if (!session) return [] as Homework[];
    return session.homeworkIds
      .map((hid) => data.homeworks.find((h) => h.id === hid))
      .filter((h): h is Homework => Boolean(h));
  }, [session, data.homeworks]);

  const hw = linkedHomeworks[0];
  const chatLang: TutorLang =
    session?.mode === "vocab"
      ? tutorLangFromSubject(
          data.vocabLists.find((v) => v.id === session.vocabListId)
            ?.languageFrom === "spanska"
            ? "Spanska"
            : data.vocabLists.find((v) => v.id === session.vocabListId)
                  ?.languageFrom === "tyska"
              ? "Tyska"
              : data.vocabLists.find((v) => v.id === session.vocabListId)
                    ?.languageFrom === "engelska"
                ? "Engelska"
                : hw?.subject,
        )
      : tutorLangFromSubjects(linkedHomeworks.map((h) => h.subject));

  useEffect(() => {
    if (!session || booted || session.finishedAt) return;
    const q0 = session.questions[0];
    const n = session.homeworkIds.length;
    const intro = introFor(chatLang, {
      vocab: session.mode === "vocab",
      multi: n > 1,
      n,
      title: session.title,
      firstQ: q0?.prompt || "",
    });
    setMessages([{ id: mid(), role: "ai", text: intro, tone: "pep" }]);
    setBooted(true);
    if (session.finishedAt) setFinished(true);
  }, [session, booted, chatLang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!busy && !finished) inputRef.current?.focus();
  }, [busy, finished, index]);

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

  const question = session.questions[index];
  const progress = Math.round(
    (session.answers.length / Math.max(session.questions.length, 1)) * 100,
  );
  const isDone = finished || Boolean(session.finishedAt);

  const persist = (next: QuizSession) => {
    upsertQuiz(next);
    notifyDataChanged();
    refresh();
  };

  const pushAi = (text: string, tone?: ChatMsg["tone"]) => {
    setMessages((m) => [...m, { id: mid(), role: "ai", text, tone }]);
  };

  const finishSession = (current: QuizSession) => {
    const correctCount = current.answers.filter((a) => a.correct).length;
    const scorePercent = Math.round(
      (correctCount / Math.max(current.answers.length, 1)) * 100,
    );
    const failed = current.answers.length - correctCount;
    persist({
      ...current,
      finishedAt: new Date().toISOString(),
      scorePercent,
    });
    pushAi(doneMsg(chatLang, scorePercent, failed), "pep");
    setFinished(true);
  };

  const advanceConversation = (
    current: QuizSession,
    tutorText: string,
    tone: ChatMsg["tone"],
  ) => {
    const nextIndex = index + 1;
    if (nextIndex >= current.questions.length) {
      setMessages((m) => [
        ...m,
        { id: mid(), role: "ai", text: tutorText, tone },
      ]);
      finishSession(current);
      return;
    }
    const nextQ = current.questions[nextIndex];
    const bridge = pick(bridgeByLang[chatLang]);
    setMessages((m) => [
      ...m,
      {
        id: mid(),
        role: "ai",
        text: `${tutorText}\n\n${bridge}\n${nextQ.prompt}`,
        tone,
      },
    ]);
    setIndex(nextIndex);
  };

  const submitAnswer = async () => {
    if (!question || isDone || busy) return;
    const text = answer.trim();
    if (!text) return;

    setBusy(true);
    setMessages((m) => [...m, { id: mid(), role: "user", text }]);
    setAnswer("");

    const attemptCount = (attempts[question.id] || 0) + 1;
    setAttempts((a) => ({ ...a, [question.id]: attemptCount }));

    let result: GradeResult = { correct: false, feedback: "…" };
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
          attemptCount,
          subject:
            chatLang === "en"
              ? "Engelska"
              : chatLang === "es"
                ? "Spanska"
                : chatLang === "de"
                  ? "Tyska"
                  : hw?.subject,
          material: linkedHomeworks
            .map((h) => h.extractedText || h.description)
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 6000),
        }),
      });
      if (res.ok) {
        result = await res.json();
      } else {
        const local =
          session.mode === "vocab"
            ? gradeVocabAnswer(text, question.expectedAnswer)
            : gradeAnswer(text, question.expectedAnswer);
        result = {
          correct: local.correct,
          feedback: local.feedback,
          next_action: local.correct ? "next_question" : "small_hint",
        };
      }
    } catch {
      const local =
        session.mode === "vocab"
          ? gradeVocabAnswer(text, question.expectedAnswer)
          : gradeAnswer(text, question.expectedAnswer);
      result = {
        correct: local.correct,
        feedback: local.feedback,
        next_action: local.correct ? "next_question" : "small_hint",
      };
    }

    const nextAction = result.next_action || (result.correct ? "next_question" : "small_hint");
    const tone: ChatMsg["tone"] = result.correct ? "ok" : "try";
    const tutorText = result.feedback || "Okej, berätta mer.";

    const current = loadData().quizSessions.find((q) => q.id === id) || session;

    // Gå vidare i samtalet när eleven fått greppet
    if (nextAction === "next_question" || result.correct) {
      const updated: QuizSession = {
        ...current,
        answers: [
          ...current.answers,
          {
            questionId: question.id,
            userAnswer: text,
            correct: true,
            feedback: tutorText,
          },
        ],
      };
      persist(updated);
      advanceConversation(updated, tutorText, tone);
      setBusy(false);
      return;
    }

    // Fortsätt på samma tema — ingen "nästa"-knapp
    setMessages((m) => [
      ...m,
      { id: mid(), role: "ai", text: tutorText, tone },
    ]);

    // Spara försök (fel) först när vi går vidare, eller spara delvis?
    // Spara senaste försök per fråga när vi lämnar — här sparar vi löpande fel bara efter 3+ eller om eleven går vidare manuellt.
    if (attemptCount >= 3) {
      // Efter flera försök: registrera och erbjud mjuk fortsättning i samma meddelande-känsla
      const already = current.answers.some((a) => a.questionId === question.id);
      if (!already) {
        persist({
          ...current,
          answers: [
            ...current.answers,
            {
              questionId: question.id,
              userAnswer: text,
              correct: false,
              feedback: tutorText,
            },
          ],
        });
      }
    }

    setBusy(false);
  };

  const continueSoftly = () => {
    if (!question || isDone) return;
    const current = loadData().quizSessions.find((q) => q.id === id) || session;
    const already = current.answers.some((a) => a.questionId === question.id);
    const updated: QuizSession = already
      ? current
      : {
          ...current,
          answers: [
            ...current.answers,
            {
              questionId: question.id,
              userAnswer: "(gick vidare)",
              correct: false,
              feedback: "Gick vidare i samtalet",
            },
          ],
        };
    if (!already) persist(updated);
    const soft =
      chatLang === "en"
        ? "No stress — we'll leave that for now."
        : chatLang === "es"
          ? "Sin prisa — lo dejamos por ahora."
          : chatLang === "de"
            ? "Kein Stress — wir lassen das erstmal."
            : "Ingen stress — vi lämnar det där för nu.";
    advanceConversation(updated, soft, "pep");
  };

  const askAnotherWay = () => {
    if (!question || isDone) return;
    const current = loadData().quizSessions.find((q) => q.id === id) || session;
    const rewritten = rewriteQuestion(question, hw);
    const questions = [
      ...current.questions.slice(0, index),
      rewritten,
      ...current.questions.slice(index + 1),
    ];
    persist({ ...current, questions });
    setAttempts((a) => ({ ...a, [rewritten.id]: 0 }));
    const lead =
      chatLang === "en"
        ? "Okay, let's try it another way:"
        : chatLang === "es"
          ? "Vale, lo intentamos de otra forma:"
          : chatLang === "de"
            ? "Okay, anders formuliert:"
            : "Okej, vi tar det på ett annat sätt:";
    pushAi(`${lead}\n\n${rewritten.prompt}`, "pep");
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
  const currentAttempts = question ? attempts[question.id] || 0 : 0;

  return (
    <div className="mx-auto flex h-[min(720px,calc(100vh-8rem))] max-w-lg flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link href="/forhor" className="text-sm text-muted hover:text-ink">
          ← Rummet
        </Link>
        <span className="text-xs text-muted">Lärsamtal</span>
      </div>

      <div className="mb-2 h-1 overflow-hidden rounded-full bg-[var(--line)]">
        <div
          className="h-full bg-sage transition-all duration-300"
          style={{ width: `${isDone ? 100 : progress}%` }}
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
            <p className="text-xs text-muted">Lärkonversation · ingen facit</p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} />
          ))}
          {busy && (
            <p className="px-2 text-xs text-muted">Buddie tänker…</p>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[var(--line)] bg-white/50 p-3">
          {!isDone ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  className="input-field min-h-[44px] flex-1 resize-none py-2.5"
                  rows={1}
                  value={answer}
                  disabled={busy}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submitAnswer();
                    }
                  }}
                  placeholder="Skriv som i ett samtal…"
                />
                <button
                  type="button"
                  className="btn-primary shrink-0 self-end"
                  onClick={() => void submitAnswer()}
                  disabled={!answer.trim() || busy}
                >
                  Skicka
                </button>
              </div>
              {currentAttempts >= 2 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    disabled={busy}
                    onClick={askAnotherWay}
                  >
                    Fråga på annat sätt
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    disabled={busy}
                    onClick={continueSoftly}
                  >
                    Gå vidare i samtalet
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {failedCount > 0 && (
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={startRetry}
                >
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
