import { NextResponse } from "next/server";
import {
  toLegacyGradePayload,
  tutorEvaluateAnswer,
} from "@/lib/tutor/openai";
import type { TutorTurn } from "@/lib/tutor/types";

export const runtime = "nodejs";

type Body = {
  prompt: string;
  expectedAnswer: string;
  userAnswer: string;
  tip?: string;
  mode?: string;
  subject?: string;
  attemptCount?: number;
  material?: string;
  /** Tidigare elevsvar på samma fråga (för att undvika loop) */
  priorAnswers?: string[];
  previousFeedback?: string;
};

/** Kort fördjupning efter rätt svar (lokal fallback utan OpenAI) */
function teachAfterCorrect(expected?: string, material?: string): string {
  const core = (expected || "").trim().replace(/\s+/g, " ");
  const snippet = core.slice(0, 180);
  const fromMaterial = (material || "").trim().replace(/\s+/g, " ").slice(0, 120);

  if (snippet.length > 20) {
    return [
      "Bra jobbat — du har det, med egna ord.",
      `För att det ska sitta ännu bättre: ${snippet}${core.length > 180 ? "…" : ""}`,
      fromMaterial
        ? "Koppla gärna tillbaka till materialet när du pluggar vidare."
        : "Tänk på varför det hänger ihop så — då blir det lättare att komma ihåg.",
      "Då tar vi vidare.",
    ].join(" ");
  }

  return "Bra jobbat — du har det viktiga. Kom ihåg att förklara med egna ord när du pluggar, då fastnar det bättre. Då tar vi vidare.";
}

function localTutorFallback(body: Body): TutorTurn {
  const attempt = Math.max(1, body.attemptCount ?? 1);
  return {
    student_message:
      attempt <= 1
        ? "Bra försök — du är igång. Titta en gång till i materialet och försök fånga den viktigaste detaljen. Vad tror du är nyckeln?"
        : attempt === 2
          ? "Nästan där. Vad saknas fortfarande jämfört med det du redan sagt?"
          : "Okej, vi reder ut det kort. Sammanfatta med egna ord vad du förstår nu.",
    evaluation: "incorrect",
    topic: "allmänt",
    next_action:
      attempt <= 1 ? "small_hint" : attempt === 2 ? "strong_hint" : "explain",
    confidence: 0.4,
  };
}

async function buildLocalTurn(body: Body): Promise<TutorTurn> {
  const { gradeAnswer, gradeVocabAnswer } = await import("@/lib/ai-quiz");
  const combined = [...(body.priorAnswers || []), body.userAnswer]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");

  if (body.mode === "vocab") {
    const graded = gradeVocabAnswer(body.userAnswer, body.expectedAnswer);
    return {
      student_message: graded.feedback,
      evaluation: graded.correct ? "correct" : "incorrect",
      topic: "glosor",
      next_action: graded.correct ? "next_question" : "small_hint",
      confidence: graded.correct ? 0.8 : 0.5,
    };
  }

  const graded = gradeAnswer(combined, body.expectedAnswer);
  const attempt = Math.max(1, body.attemptCount ?? 1);

  if (graded.correct) {
    const teach = teachAfterCorrect(body.expectedAnswer, body.material);
    return {
      student_message: teach,
      evaluation: "correct",
      topic: "allmänt",
      next_action: "next_question",
      confidence: 0.75,
    };
  }

  if (graded.partial) {
    return {
      student_message: graded.feedback,
      evaluation: "partially_correct",
      topic: "allmänt",
      next_action: "clarify",
      confidence: 0.65,
    };
  }

  if (attempt <= 1) {
    return {
      student_message: body.tip
        ? `Bra att du försöker. Liten ledtråd: ${body.tip} Vad kan du svara nu — med egna ord?`
        : "Bra att du försöker. Titta tillbaka i materialet — vad är det viktigaste, med egna ord?",
      evaluation: "incorrect",
      topic: "allmänt",
      next_action: "small_hint",
      confidence: 0.55,
    };
  }

  if (attempt === 2) {
    return {
      student_message:
        "Vi tar det i mindre steg. Vad är den del du är säker på? Skriv bara den.",
      evaluation: "incorrect",
      topic: "allmänt",
      next_action: "strong_hint",
      confidence: 0.5,
    };
  }

  return {
    student_message:
      "Efter flera försök: förklara kort med egna ord vad du tror gäller utifrån materialet.",
    evaluation: "incorrect",
    topic: "allmänt",
    next_action: "explain",
    confidence: 0.45,
  };
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const priorAnswers = (body.priorAnswers || [])
    .map((s) => String(s).trim())
    .filter(Boolean);

  if (!body.userAnswer?.trim()) {
    const turn: TutorTurn = {
      student_message: "Skriv ett svar först, så tittar vi på det tillsammans.",
      evaluation: "not_assessable",
      topic: "allmänt",
      next_action: "clarify",
      confidence: 1,
    };
    return NextResponse.json(toLegacyGradePayload(turn));
  }

  if (!body.expectedAnswer?.trim() && !body.material?.trim()) {
    const turn: TutorTurn = {
      student_message:
        "Jag hittar inte tillräckligt med material för att bedöma det här. Kan du kolla att läxan har text eller foto?",
      evaluation: "not_assessable",
      topic: "allmänt",
      next_action: "clarify",
      confidence: 0.8,
    };
    return NextResponse.json(toLegacyGradePayload(turn));
  }

  const ai = await tutorEvaluateAnswer({
    question: body.prompt,
    expectedAnswer: body.expectedAnswer,
    userAnswer: body.userAnswer,
    priorAnswers,
    previousFeedback: body.previousFeedback,
    tip: body.tip,
    material: body.material,
    attemptCount: body.attemptCount,
    mode: body.mode,
    subject: body.subject,
  });

  if (ai) {
    return NextResponse.json(toLegacyGradePayload(ai));
  }

  try {
    const local = await buildLocalTurn({ ...body, priorAnswers });
    return NextResponse.json(toLegacyGradePayload(local));
  } catch {
    return NextResponse.json(
      toLegacyGradePayload(localTutorFallback({ ...body, priorAnswers })),
    );
  }
}
