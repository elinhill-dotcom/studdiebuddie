"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notifyDataChanged, useAppData } from "@/components/useAppData";
import { gradeAnswer, gradeVocabAnswer, rewriteQuestion } from "@/lib/ai-quiz";
import { loadData, upsertExam, upsertQuiz } from "@/lib/store";
import type { Homework, QuizSession } from "@/lib/types";
import {
  tutorLangFromSubject,
  tutorLangFromSubjects,
  type TutorLang,
} from "@/lib/tutor-lang";

const SESSION_MS = 15 * 60 * 1000;

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

function formatClock(sec: number) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
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
  const timeNote =
    lang === "en"
      ? "We'll chat for about 15 minutes, then I'll wrap up with tips on what to practise."
      : lang === "es"
        ? "Hablaremos unos 15 minutos y luego te daré tips de qué practicar."
        : lang === "de"
          ? "Wir sprechen etwa 15 Minuten, dann fasse ich zusammen, was du üben solltest."
          : "Vi håller på i ungefär 15 minuter — sen rundar jag av med tips på vad du kan träna mer.";

  if (opts.vocab) {
    if (lang === "en")
      return `Hi! I'm your study buddy. We'll chat through the vocab in “${name}”. ${timeNote} I won't give the answer key.\n\n${opts.firstQ}`;
    if (lang === "es")
      return `¡Hola! Soy tu compañero de estudio. Hablaremos del vocabulario de “${name}”. ${timeNote} Sin respuesta directa.\n\n${opts.firstQ}`;
    if (lang === "de")
      return `Hallo! Ich bin dein Lernbuddy. Wir sprechen über die Vokabeln in „${name}“. ${timeNote} Keine direkte Lösung.\n\n${opts.firstQ}`;
    return `Hej! Jag är din pluggkompis. Vi snackar oss igenom glosorna i “${name}”. ${timeNote} Ingen facit.\n\n${opts.firstQ}`;
  }
  if (opts.multi) {
    if (lang === "en")
      return `Hi! I've read ${opts.n} of your homework assignments. ${timeNote}\n\n${opts.firstQ}`;
    if (lang === "es")
      return `¡Hola! He leído ${opts.n} deberes. ${timeNote}\n\n${opts.firstQ}`;
    if (lang === "de")
      return `Hallo! Ich habe ${opts.n} Hausaufgaben gelesen. ${timeNote}\n\n${opts.firstQ}`;
    return `Hej! Jag har läst ${opts.n} av dina läxor. ${timeNote}\n\n${opts.firstQ}`;
  }
  if (lang === "en")
    return `Hi! I've read your material. ${timeNote}\n\n${opts.firstQ}`;
  if (lang === "es")
    return `¡Hola! He leído tu material. ${timeNote}\n\n${opts.firstQ}`;
  if (lang === "de")
    return `Hallo! Ich habe dein Material gelesen. ${timeNote}\n\n${opts.firstQ}`;
  return `Hej! Jag har läst ditt material. ${timeNote}\n\n${opts.firstQ}`;
}

function buildPracticeTips(session: QuizSession): string[] {
  const failedIds = new Set(
    session.answers.filter((a) => !a.correct).map((a) => a.questionId),
  );
  const tips: string[] = [];
  for (const q of session.questions) {
    if (!failedIds.has(q.id)) continue;
    const topic = q.topic?.trim();
    if (topic && !tips.includes(topic)) tips.push(topic);
  }
  // Om inga topics: korta frågeutdrag
  if (!tips.length) {
    for (const q of session.questions) {
      if (!failedIds.has(q.id)) continue;
      const short = q.prompt.trim().slice(0, 60);
      if (short) tips.push(short + (q.prompt.length > 60 ? "…" : ""));
      if (tips.length >= 4) break;
    }
  }
  return tips.slice(0, 5);
}

function wrapUpMsg(
  lang: TutorLang,
  opts: {
    scorePercent: number;
    timedOut: boolean;
    tips: string[];
  },
) {
  const tipBlock =
    opts.tips.length > 0
      ? lang === "en"
        ? `\n\nPractise more:\n${opts.tips.map((t) => `• ${t}`).join("\n")}\n\nThen come back for a new quiz — you'll notice the difference.`
        : lang === "es"
          ? `\n\nPractica más:\n${opts.tips.map((t) => `• ${t}`).join("\n")}\n\nLuego vuelve a hacer un nuevo quiz.`
          : lang === "de"
            ? `\n\nÜbe besonders:\n${opts.tips.map((t) => `• ${t}`).join("\n")}\n\nKomm danach zu einem neuen Quiz zurück.`
            : `\n\nTräna mer på:\n${opts.tips.map((t) => `• ${t}`).join("\n")}\n\nKom sedan tillbaka och gör ett nytt förhör — då märker du skillnaden.`
      : lang === "en"
        ? "\n\nYou handled this well. A new quiz anytime is a great way to keep it fresh."
        : lang === "es"
          ? "\n\nLo llevaste bien. Un nuevo quiz cuando quieras ayuda a fijarlo."
          : lang === "de"
            ? "\n\nDas lief gut. Ein neues Quiz hält es frisch."
            : "\n\nDu hade bra grepp. Ett nytt förhör när du vill hjälper dig hålla kvar det.";

  if (opts.timedOut) {
    if (lang === "en")
      return `Time's up — nice 15-minute session (${opts.scorePercent}% on what we covered).${tipBlock}`;
    if (lang === "es")
      return `Se acabó el tiempo — buenos 15 minutos (${opts.scorePercent}% en lo que vimos).${tipBlock}`;
    if (lang === "de")
      return `Zeit ist um — gute 15 Minuten (${opts.scorePercent}% zu dem, was wir geschafft haben).${tipBlock}`;
    return `Tiden är slut — fint 15-minuterspass (${opts.scorePercent}% på det vi hann).${tipBlock}`;
  }

  if (lang === "en")
    return `Let's wrap up here (${opts.scorePercent}%). Great chat!${tipBlock}`;
  if (lang === "es")
    return `Cerremos aquí (${opts.scorePercent}%). ¡Buena charla!${tipBlock}`;
  if (lang === "de")
    return `Wir runden ab (${opts.scorePercent}%). Schönes Gespräch!${tipBlock}`;
  return `Vi rundar av här (${opts.scorePercent}%). Bra samtal!${tipBlock}`;
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
  const [practiceTips, setPracticeTips] = useState<string[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const finishingRef = useRef(false);

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

  // 15-minuterspass
  useEffect(() => {
    if (!session || session.finishedAt || finished) return;
    const endAt = new Date(session.startedAt).getTime() + SESSION_MS;

    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !finishingRef.current) {
        finishingRef.current = true;
        const current =
          loadData().quizSessions.find((q) => q.id === id) || session;
        finishSessionRef.current?.(current, true);
      }
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [session, finished, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!busy && !finished) inputRef.current?.focus();
  }, [busy, finished, index]);

  const persist = useCallback(
    (next: QuizSession) => {
      upsertQuiz(next);
      notifyDataChanged();
      refresh();
    },
    [refresh],
  );

  const finishSession = useCallback(
    (current: QuizSession, timedOut: boolean) => {
      if (finished || current.finishedAt) return;
      finishingRef.current = true;
      const answered = current.answers;
      const correctCount = answered.filter((a) => a.correct).length;
      const scorePercent = answered.length
        ? Math.round((correctCount / answered.length) * 100)
        : 0;
      const tips = buildPracticeTips(current);
      setPracticeTips(tips);

      const updated: QuizSession = {
        ...current,
        finishedAt: new Date().toISOString(),
        scorePercent,
      };
      persist(updated);

      if (hw || tips.length) {
        upsertExam({
          id: crypto.randomUUID(),
          title: current.title,
          subject: hw?.subject || "Annat",
          date: new Date().toISOString().slice(0, 10),
          scorePercent,
          reflection: timedOut ? "15-minuters förhör" : "Förhör avslutat",
          weakTopics: tips,
          relatedHomeworkIds: current.homeworkIds,
          createdAt: new Date().toISOString(),
        });
        notifyDataChanged();
      }

      setMessages((m) => [
        ...m,
        {
          id: mid(),
          role: "ai",
          text: wrapUpMsg(chatLang, { scorePercent, timedOut, tips }),
          tone: "pep",
        },
      ]);
      setFinished(true);
    },
    [finished, persist, hw, chatLang],
  );

  const finishSessionRef = useRef(finishSession);
  finishSessionRef.current = finishSession;

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
  const isDone = finished || Boolean(session.finishedAt);
  const timeAlmostUp = secondsLeft <= 30;

  const pushAi = (text: string, tone?: ChatMsg["tone"]) => {
    setMessages((m) => [...m, { id: mid(), role: "ai", text, tone }]);
  };

  const advanceConversation = (
    current: QuizSession,
    tutorText: string,
    tone: ChatMsg["tone"],
  ) => {
    // Tiden nästan slut → runda av i stället för ny fråga
    if (secondsLeft <= 20) {
      setMessages((m) => [
        ...m,
        { id: mid(), role: "ai", text: tutorText, tone },
      ]);
      finishSession(current, true);
      return;
    }

    const nextIndex = index + 1;
    if (nextIndex >= current.questions.length) {
      setMessages((m) => [
        ...m,
        { id: mid(), role: "ai", text: tutorText, tone },
      ]);
      finishSession(current, false);
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
              userAnswer: "(låste sig — gick vidare)",
              correct: false,
              feedback: "Gick vidare",
            },
          ],
        };
    if (!already) persist(updated);
    const soft =
      chatLang === "en"
        ? "No stress — we'll leave that for now and keep talking."
        : chatLang === "es"
          ? "Sin prisa — lo dejamos y seguimos hablando."
          : chatLang === "de"
            ? "Kein Stress — wir lassen das und reden weiter."
            : "Ingen stress — vi lämnar det och pratar vidare.";
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
    if (!base.length) {
      // Nytt förhör på samma läxor
      const href =
        current.homeworkIds.length === 1
          ? `/forhor/start?homework=${current.homeworkIds[0]}`
          : `/forhor/start?homeworks=${current.homeworkIds.join(",")}`;
      window.location.href = href;
      return;
    }
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

  const startFreshQuiz = () => {
    if (session.mode === "vocab" && session.vocabListId) {
      window.location.href = `/glosor/${session.vocabListId}`;
      return;
    }
    const href =
      session.homeworkIds.length === 1
        ? `/forhor/start?homework=${session.homeworkIds[0]}`
        : session.homeworkIds.length > 1
          ? `/forhor/start?homeworks=${session.homeworkIds.join(",")}`
          : "/forhor";
    window.location.href = href;
  };

  const latest = loadData().quizSessions.find((q) => q.id === id) || session;
  const failedCount = latest.answers.filter((a) => !a.correct).length;
  const tipsShown = practiceTips.length
    ? practiceTips
    : buildPracticeTips(latest);

  return (
    <div className="mx-auto flex h-[min(720px,calc(100vh-8rem))] max-w-lg flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link href="/forhor" className="text-sm text-muted hover:text-ink">
          ← Rummet
        </Link>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
            isDone
              ? "bg-sage-soft text-sage"
              : timeAlmostUp
                ? "bg-coral/15 text-coral"
                : "bg-sky-soft text-sky"
          }`}
        >
          {isDone ? "Klart" : formatClock(secondsLeft)}
        </span>
      </div>

      <div className="mb-2 h-1 overflow-hidden rounded-full bg-[var(--line)]">
        <div
          className={`h-full transition-all duration-300 ${
            timeAlmostUp && !isDone ? "bg-coral" : "bg-sage"
          }`}
          style={{
            width: `${
              isDone
                ? 100
                : Math.min(
                    100,
                    ((SESSION_MS / 1000 - secondsLeft) / (SESSION_MS / 1000)) *
                      100,
                  )
            }%`,
          }}
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
            <p className="text-xs text-muted">
              Lärsamtal · ca 15 min · ingen facit
            </p>
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
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={busy}
                  onClick={continueSoftly}
                >
                  Jag låser mig — gå vidare
                </button>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  disabled={busy}
                  onClick={askAnotherWay}
                >
                  Fråga på annat sätt
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {tipsShown.length > 0 && (
                <div className="rounded-xl bg-brass-soft/50 px-3 py-2 text-sm">
                  <p className="font-semibold text-brass">Träna mer på</p>
                  <ul className="mt-1 list-inside list-disc text-ink-soft">
                    {tipsShown.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={startFreshQuiz}
                >
                  Nytt förhör
                </button>
                {failedCount > 0 && (
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={startRetry}
                  >
                    Träna det jag missade
                  </button>
                )}
                <Link href="/forhor" className="btn-ghost text-sm">
                  Till förhörsrummet
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
