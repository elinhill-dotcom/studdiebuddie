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
  /** How many genuine attempts on this question (1-based). Optional. */
  attemptCount?: number;
  /** Optional uploaded material excerpt for grounding. */
  material?: string;
};

function localTutorFallback(body: Body): TutorTurn {
  // Keep behaviour aligned with rules when OpenAI is unavailable.
  // Does not reveal expectedAnswer in student_message.
  const attempt = Math.max(1, body.attemptCount ?? 1);

  // Dynamic import avoids pulling client-safe paths oddly; sync require via import at top is fine too.
  // Use static imports instead below via already-available helpers.
  return {
    student_message:
      attempt <= 1
        ? "Bra försök — du är igång. Titta en gång till i materialet och försök fånga den viktigaste detaljen. Vad tror du är nyckeln?"
        : attempt === 2
          ? "Nästan där. Dela upp det i två steg: vad vet du säkert, och vad saknas fortfarande? Börja med det du är säker på."
          : "Okej, vi reder ut det kort utifrån materialet, utan att gissa. Läs tipset om du har ett, sammanfatta sedan med egna ord vad du förstod.",
    evaluation: "incorrect",
    topic: "allmänt",
    next_action:
      attempt <= 1 ? "small_hint" : attempt === 2 ? "strong_hint" : "explain",
    confidence: 0.4,
  };
}

async function buildLocalTurn(body: Body): Promise<TutorTurn> {
  const { gradeAnswer, gradeVocabAnswer } = await import("@/lib/ai-quiz");
  const graded =
    body.mode === "vocab"
      ? gradeVocabAnswer(body.userAnswer, body.expectedAnswer)
      : gradeAnswer(body.userAnswer, body.expectedAnswer);

  const attempt = Math.max(1, body.attemptCount ?? 1);

  if (graded.correct) {
    return {
      student_message:
        "Bra resonemang — det stämmer. Du använde materialet på ett tydligt sätt.",
      evaluation: "correct",
      topic: "allmänt",
      next_action: "next_question",
      confidence: 0.7,
    };
  }

  if (attempt <= 1) {
    return {
      student_message: body.tip
        ? `Bra att du försöker. Liten ledtråd: ${body.tip} Vad kan du svara nu?`
        : "Bra att du försöker. Titta tillbaka i materialet efter den viktigaste ledtråden — vad ser du där?",
      evaluation: "incorrect",
      topic: "allmänt",
      next_action: "small_hint",
      confidence: 0.55,
    };
  }

  if (attempt === 2) {
    return {
      student_message:
        "Vi tar det i mindre steg. Vad är första delen du är säker på? Skriv bara den delen.",
      evaluation: "incorrect",
      topic: "allmänt",
      next_action: "strong_hint",
      confidence: 0.5,
    };
  }

  return {
    student_message:
      "Efter flera försök: gå tillbaka till materialet och jämför din formulering med den viktiga delen där. Förklara sedan med egna ord vad du tror gäller — utan att kopiera rakt av.",
    evaluation: "incorrect",
    topic: "allmänt",
    next_action: "explain",
    confidence: 0.45,
  };
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

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
    const local = await buildLocalTurn(body);
    return NextResponse.json(toLegacyGradePayload(local));
  } catch {
    return NextResponse.json(toLegacyGradePayload(localTutorFallback(body)));
  }
}
