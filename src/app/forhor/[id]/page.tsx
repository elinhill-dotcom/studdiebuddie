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

function mid() {
  return crypto.randomUUID();
}

const pepByLang: Record<
  TutorLang,
  { ok: string[]; no: string[]; next: string[]; empty: string }
> = {
  sv: {
    ok: [
      "Snyggt jobbat — du har det!",
      "Ja! Bra tänkt.",
      "Klockrent. Fortsätt så.",
      "Yes! Du är inne på rätt spår.",
    ],
    no: [
      "Ingen fara — så här lär man sig.",
      "Bra försök! Vi tar det igen, lugnt.",
      "Nästan. Du är närmare än du tror.",
      "Helt okej att missa. Vi kör vidare.",
    ],
    next: [
      "Här kommer nästa:",
      "Då kör vi vidare:",
      "Nästa fråga till dig:",
      "Okej, lyssna här:",
    ],
    empty: "Hmm, jag hittar inga frågor just nu.",
  },
  en: {
    ok: [
      "Nice work — you got it!",
      "Yes! Good thinking.",
      "Spot on. Keep going.",
      "Great — you're on the right track.",
    ],
    no: [
      "No worries — this is how we learn.",
      "Good try! Let's try again, calmly.",
      "Almost. You're closer than you think.",
      "It's okay to miss it. Let's continue.",
    ],
    next: [
      "Here's the next one:",
      "Let's keep going:",
      "Next question for you:",
      "Okay, listen up:",
    ],
    empty: "Hmm, I can't find any questions right now.",
  },
  es: {
    ok: [
      "¡Bien hecho!",
      "¡Sí! Buen razonamiento.",
      "Exacto. Sigue así.",
      "Genial — vas por buen camino.",
    ],
    no: [
      "No pasa nada — así se aprende.",
      "¡Buen intento! Probamos otra vez, con calma.",
      "Casi. Estás más cerca de lo que crees.",
      "Fallar está bien. Seguimos.",
    ],
    next: [
      "Aquí va la siguiente:",
      "Seguimos:",
      "Siguiente pregunta:",
      "Vale, escucha:",
    ],
    empty: "Hmm, no encuentro preguntas ahora.",
  },
  de: {
    ok: [
      "Super gemacht!",
      "Ja! Gut gedacht.",
      "Genau. Weiter so.",
      "Toll — du bist auf dem richtigen Weg.",
    ],
    no: [
      "Kein Problem — so lernt man.",
      "Guter Versuch! Wir versuchen es nochmal, ruhig.",
      "Fast. Du bist näher dran, als du denkst.",
      "Fehler sind okay. Weiter geht's.",
    ],
    next: [
      "Hier kommt die nächste:",
      "Weiter geht's:",
      "Nächste Frage:",
      "Okay, hör zu:",
    ],
    empty: "Hmm, ich finde gerade keine Fragen.",
  },
};

function pick(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function introFor(
  lang: TutorLang,
  opts: { vocab: boolean; multi: boolean; n: number; title: string },
) {
  const name = opts.title.replace(/^Glosförhör:\s*/, "");
  if (opts.vocab) {
    if (lang === "en")
      return `Hi! I'm your study buddy. We'll do a vocab quiz: “${name}”. I ask — you answer. I never give the answer key, just tips and encouragement.`;
    if (lang === "es")
      return `¡Hola! Soy tu compañero de estudio. Haremos un quiz de vocabulario: “${name}”. Yo pregunto — tú respondes. Nunca doy la respuesta directa, solo pistas y ánimo.`;
    if (lang === "de")
      return `Hallo! Ich bin dein Lernbuddy. Wir machen ein Vokabelquiz: „${name}“. Ich frage — du antwortest. Ich gebe nie die direkte Lösung, nur Tipps und Mut.`;
    return `Hej! Jag är din pluggkompis. Vi kör glosförhör: “${name}”. Jag ställer frågor — du svarar. Jag ger aldrig facit, bara pepp och tips.`;
  }
  if (opts.multi) {
    if (lang === "en")
      return `Hi! I'm your study buddy. I've read ${opts.n} of your saved homework assignments and made questions from them. Answer in your own words — I'll say if you're right or wrong, but I never give the answer key.`;
    if (lang === "es")
      return `¡Hola! Soy tu compañero de estudio. He leído ${opts.n} deberes guardados y he creado preguntas. Responde con tus palabras — te digo si está bien o mal, pero nunca doy la respuesta directa.`;
    if (lang === "de")
      return `Hallo! Ich bin dein Lernbuddy. Ich habe ${opts.n} gespeicherte Hausaufgaben gelesen und Fragen daraus gemacht. Antworte mit eigenen Worten — ich sage, ob es stimmt, aber gebe nie die direkte Lösung.`;
    return `Hej! Jag är din pluggkompis. Jag har läst ${opts.n} sparade läxor och hittat på frågor utifrån dem. Svara med egna ord — jag säger om det är rätt eller fel, men jag ger aldrig facit.`;
  }
  if (lang === "en")
    return `Hi! I'm your study buddy. I've read your uploaded material and made questions from it. Answer in your own words — I'll say if you're right or wrong, but I never give the answer key.`;
  if (lang === "es")
    return `¡Hola! Soy tu compañero de estudio. He leído tu material y he creado preguntas. Responde con tus palabras — te digo si está bien o mal, pero nunca doy la respuesta directa.`;
  if (lang === "de")
    return `Hallo! Ich bin dein Lernbuddy. Ich habe dein Material gelesen und Fragen daraus gemacht. Antworte mit eigenen Worten — ich sage, ob es stimmt, aber gebe nie die direkte Lösung.`;
  return `Hej! Jag är din pluggkompis. Jag har läst ditt uppladdade material och hittat på frågor utifrån det. Svara med egna ord — jag säger om det är rätt eller fel, men jag ger aldrig facit.`;
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

  // Starta chatten en gång
  useEffect(() => {
    if (!session || booted || session.finishedAt) return;
    const q0 = session.questions[0];
    const n = session.homeworkIds.length;
    const lang =
      session.mode === "vocab"
        ? chatLang
        : tutorLangFromSubjects(linkedHomeworks.map((h) => h.subject));
    const pep = pepByLang[lang];
    const intro = introFor(lang, {
      vocab: session.mode === "vocab",
      multi: n > 1,
      n,
      title: session.title,
    });
    setMessages([
      { id: mid(), role: "ai", text: intro, tone: "pep" },
      {
        id: mid(),
        role: "ai",
        text: q0 ? `${pick(pep.next)} ${q0.prompt}` : pep.empty,
      },
    ]);
    setBooted(true);
  }, [session, booted, linkedHomeworks, chatLang]);

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

    const pep = pepByLang[chatLang];

    setMessages((m) => [
      ...m,
      {
        id: mid(),
        role: "ai",
        text: result.correct
          ? `${pick(pep.ok)} ${result.feedback}`
          : `${pick(pep.no)} ${result.feedback}${
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
    pushAi(`${pick(pepByLang[chatLang].next)} ${nextQ.prompt}`);
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
