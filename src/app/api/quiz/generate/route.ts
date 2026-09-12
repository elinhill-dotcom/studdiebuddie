import { NextResponse } from "next/server";
import type { Homework, QuizQuestion } from "@/lib/types";
import {
  combinedAttachmentText,
  hasQuizMaterial,
  normalizeAttachments,
} from "@/lib/attachments";
import { inventQuestionsFromHomework } from "@/lib/invent-questions";
import { generateQuestionsFromHomework } from "@/lib/ai-quiz";
import { tutorGenerateQuestions } from "@/lib/tutor/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  homework: Homework;
  count?: number;
  format?: "chat" | "exam" | "flashcards";
};

function withIds(
  qs: Array<{
    prompt: string;
    expectedAnswer: string;
    tip?: string;
    topic?: string;
  }>,
): QuizQuestion[] {
  return qs.map((q) => ({
    id: crypto.randomUUID(),
    prompt: q.prompt,
    expectedAnswer: q.expectedAnswer,
    tip: q.tip,
    topic: q.topic,
  }));
}

function materialBlock(hw: Homework) {
  const langNote =
    hw.subject === "Engelska"
      ? "engelska (skriv frågor och tips på engelska)"
      : hw.subject === "Spanska"
        ? "spanska (skriv frågor och tips på spanska)"
        : hw.subject === "Tyska"
          ? "tyska (skriv frågor och tips på tyska)"
          : "svenska";
  const material =
    combinedAttachmentText(hw) ||
    hw.extractedText ||
    "(ingen text – använd bilderna/PDF:erna om de finns)";
  return [
    `Titel: ${hw.title}`,
    `Ämne: ${hw.subject}`,
    `Svarsspråk: ${langNote}`,
    hw.description && `Beskrivning: ${hw.description}`,
    hw.helpNeeded && `Eleven behöver extra hjälp med: ${hw.helpNeeded}`,
    hw.pageHints && `Sidhänvisning i häftet: ${hw.pageHints}`,
    `Material från läxan:\n${material}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const hw = body.homework;
    const count = Math.min(Math.max(body.count ?? 6, 3), 12);

    if (!hw?.id) {
      return NextResponse.json({ error: "Saknar läxa" }, { status: 400 });
    }

    if (!hasQuizMaterial(hw)) {
      return NextResponse.json(
        { error: "Läxan saknar text, foto eller PDF att göra frågor utifrån." },
        { status: 400 },
      );
    }

    const attachments = normalizeAttachments(hw).map((a) => ({
      kind: a.kind,
      dataUrl: a.dataUrl,
      fileName: a.fileName,
    }));

    const ai = await tutorGenerateQuestions({
      materialText: materialBlock(hw),
      count,
      format: body.format,
      photoDataUrl: hw.photoDataUrl,
      pdfDataUrl: hw.pdfDataUrl,
      pdfFileName: hw.pdfFileName,
      attachments,
    });

    if (ai?.questions?.length) {
      return NextResponse.json({
        questions: withIds(ai.questions),
        source: "ai",
      });
    }

    const local = inventQuestionsFromHomework(hw, count);
    const questions =
      local.length >= 2 ? local : generateQuestionsFromHomework(hw, count);

    return NextResponse.json({
      questions,
      source: "local",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Kunde inte skapa frågor" }, { status: 500 });
  }
}
