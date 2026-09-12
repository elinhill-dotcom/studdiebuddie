/**
 * OpenAI Responses API helper — server-only.
 * API key never leaves the server.
 */

import OpenAI from "openai";
import {
  QUESTION_GEN_INSTRUCTIONS,
  TUTOR_TURN_INSTRUCTIONS,
} from "./instructions";
import type {
  GenerateQuestionsResult,
  GeneratedQuestion,
  TutorTurn,
} from "./types";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
  });
}

const tutorTurnSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "student_message",
    "evaluation",
    "topic",
    "next_action",
    "confidence",
  ],
  properties: {
    student_message: { type: "string" },
    evaluation: {
      type: "string",
      enum: ["correct", "partially_correct", "incorrect", "not_assessable"],
    },
    topic: { type: "string" },
    next_action: {
      type: "string",
      enum: [
        "next_question",
        "small_hint",
        "strong_hint",
        "explain",
        "clarify",
      ],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

const generateQuestionsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["prompt", "expectedAnswer", "tip", "topic"],
        properties: {
          prompt: { type: "string" },
          expectedAnswer: { type: "string" },
          tip: { type: "string" },
          topic: { type: "string" },
        },
      },
    },
  },
} as const;

function clampConfidence(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (Number.isNaN(v)) return 0.5;
  return Math.min(1, Math.max(0, v));
}

function parseTutorTurn(raw: string): TutorTurn | null {
  try {
    const parsed = JSON.parse(raw) as TutorTurn;
    if (!parsed.student_message?.trim()) return null;
    if (
      ![
        "correct",
        "partially_correct",
        "incorrect",
        "not_assessable",
      ].includes(parsed.evaluation)
    ) {
      return null;
    }
    if (
      ![
        "next_question",
        "small_hint",
        "strong_hint",
        "explain",
        "clarify",
      ].includes(parsed.next_action)
    ) {
      return null;
    }
    return {
      student_message: parsed.student_message.trim(),
      evaluation: parsed.evaluation,
      topic: String(parsed.topic || "").trim() || "allmänt",
      next_action: parsed.next_action,
      confidence: clampConfidence(parsed.confidence),
    };
  } catch {
    return null;
  }
}

async function createStructuredResponse(args: {
  instructions: string;
  input: OpenAI.Responses.ResponseInput;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<string | null> {
  const openai = getClient();
  if (!openai) return null;

  try {
    // Responses API — nyckel endast server-side, store: false
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",

      instructions: args.instructions,
      // t.ex. "Du är Studdiebuddie... Ge inte facit direkt...
      // Utgå från uppladdat material... Ge ledtrådar..."

      input: args.input,

      store: false,

      text: {
        format: {
          type: "json_schema",
          name: args.schemaName,
          strict: true,
          schema: args.schema,
        },
      },
    });

    const text = response.output_text?.trim();
    return text || null;
  } catch (err) {
    console.error("OpenAI Responses API error", err);
    return null;
  }
}

export async function tutorEvaluateAnswer(args: {
  question: string;
  expectedAnswer: string;
  userAnswer: string;
  priorAnswers?: string[];
  previousFeedback?: string;
  tip?: string;
  material?: string;
  attemptCount?: number;
  mode?: string;
  subject?: string;
}): Promise<TutorTurn | null> {
  const attemptCount = Math.max(1, args.attemptCount ?? 1);
  const priorAnswers = (args.priorAnswers || [])
    .map((s) => s.trim())
    .filter(Boolean);
  const combinedAnswer = [...priorAnswers, args.userAnswer.trim()]
    .filter(Boolean)
    .join("\n");
  const payload = {
    question: args.question,
    expectedAnswer: args.expectedAnswer,
    userAnswer: args.userAnswer,
    priorAnswers,
    combinedAnswer,
    previousFeedback: args.previousFeedback || null,
    tip: args.tip || null,
    material: args.material || null,
    attemptCount,
    mode: args.mode || "single",
    subject: args.subject || null,
  };

  const raw = await createStructuredResponse({
    instructions: TUTOR_TURN_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: `Evaluate this student turn. Remember priorAnswers. Accept own words. Return JSON only.\n\n${JSON.stringify(payload)}`,
      },
    ],
    schemaName: "tutor_turn",
    schema: tutorTurnSchema as unknown as Record<string, unknown>,
  });

  if (!raw) return null;
  return parseTutorTurn(raw);
}

export async function tutorGenerateQuestions(args: {
  materialText: string;
  count: number;
  format?: "chat" | "exam" | "flashcards";
  photoDataUrl?: string;
  pdfDataUrl?: string;
  pdfFileName?: string;
  attachments?: Array<{
    kind: "image" | "pdf";
    dataUrl: string;
    fileName?: string;
  }>;
}): Promise<GenerateQuestionsResult | null> {
  const content: OpenAI.Responses.ResponseInputContent[] = [
    {
      type: "input_text",
      text: `Create ${args.count} distinct questions from ONLY this uploaded material. Cover the whole provided section, including its middle and ending, all major headings, concepts and comparisons. Do not repeat the same fact to reach the count. ${args.format === "flashcards" ? "Create concise flashcards: one focused recall question per prompt, and a short self-contained answer on the reverse in expectedAnswer." : args.format === "exam" ? "Create written exam questions with clear, assessable answer keys, varying recall, explanation and comparison." : "Create natural oral discussion questions, each with a clear answer key."} Return JSON only.\n\n${args.materialText}`,
    },
  ];

  const attachments =
    args.attachments?.length
      ? args.attachments
      : [
          ...(args.photoDataUrl
            ? [{ kind: "image" as const, dataUrl: args.photoDataUrl }]
            : []),
          ...(args.pdfDataUrl
            ? [
                {
                  kind: "pdf" as const,
                  dataUrl: args.pdfDataUrl,
                  fileName: args.pdfFileName,
                },
              ]
            : []),
        ];

  // Begränsa antal filer till OpenAI (texten täcker resten)
  const images = attachments.filter((a) => a.kind === "image").slice(0, 6);
  const pdfs = attachments.filter((a) => a.kind === "pdf").slice(0, 3);

  for (const img of images) {
    if (
      img.dataUrl?.startsWith("data:image") ||
      img.dataUrl?.startsWith("http")
    ) {
      content.push({
        type: "input_image",
        image_url: img.dataUrl,
        detail: "auto",
      });
    }
  }

  for (const pdf of pdfs) {
    // Skippa extremt stora PDF:er — texten finns redan i materialText
    if (pdf.dataUrl?.startsWith("data:") && pdf.dataUrl.length > 8_000_000) {
      continue;
    }
    const pdfPayload = await resolvePdfDataUrl(pdf.dataUrl);
    if (pdfPayload && pdfPayload.length < 8_000_000) {
      content.push({
        type: "input_file",
        filename: pdf.fileName || "laxa.pdf",
        file_data: pdfPayload,
      } as OpenAI.Responses.ResponseInputContent);
    }
  }

  const raw = await createStructuredResponse({
    instructions: QUESTION_GEN_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content,
      },
    ],
    schemaName: "quiz_questions",
    schema: generateQuestionsSchema as unknown as Record<string, unknown>,
  });

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { questions?: GeneratedQuestion[] };
    const questions = (parsed.questions || [])
      .filter((q) => q.prompt?.trim() && q.expectedAnswer?.trim())
      .map((q) => ({
        prompt: q.prompt.trim(),
        expectedAnswer: q.expectedAnswer.trim(),
        tip: q.tip?.trim() || undefined,
        topic: q.topic?.trim() || undefined,
      }));
    if (!questions.length) return null;
    return { questions: questions.slice(0, args.count) };
  } catch {
    return null;
  }
}

async function resolvePdfDataUrl(url?: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:application/pdf")) return url;
  if (!url.startsWith("http")) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:application/pdf;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const vocabExtractSchema = {
  type: "object",
  additionalProperties: false,
  required: ["pairs", "languageFrom", "languageTo"],
  properties: {
    languageFrom: { type: "string" },
    languageTo: { type: "string" },
    pairs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "translation"],
        properties: {
          term: { type: "string" },
          translation: { type: "string" },
        },
      },
    },
  },
} as const;

/** Läser glosor från bild/PDF (eller råtext) via OpenAI */
export async function extractVocabFromUpload(args: {
  photoDataUrl?: string;
  pdfDataUrl?: string;
  pdfFileName?: string;
  extractedText?: string;
  languageFromHint?: string;
  languageToHint?: string;
}): Promise<{
  pairs: { term: string; translation: string }[];
  languageFrom?: string;
  languageTo?: string;
} | null> {
  const content: OpenAI.Responses.ResponseInputContent[] = [
    {
      type: "input_text",
      text: [
        "Extract every vocabulary pair from this gloss list / word list.",
        "There may be many rows and several photographed pages. Do not stop after three pairs; continue until every clearly visible row on this image is included.",
        "Return JSON only: languageFrom, languageTo, pairs[{term, translation}].",
        "term = left/source language word, translation = right/target language.",
        "Skip headers, page numbers, and empty rows. Keep original spelling.",
        args.languageFromHint
          ? `Hint languageFrom: ${args.languageFromHint}`
          : "",
        args.languageToHint ? `Hint languageTo: ${args.languageToHint}` : "",
        args.extractedText?.trim()
          ? `Text extracted from PDF:\n${args.extractedText.trim().slice(0, 12000)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  if (args.photoDataUrl?.startsWith("data:image") || args.photoDataUrl?.startsWith("http")) {
    content.push({
      type: "input_image",
      image_url: args.photoDataUrl,
      detail: "high",
    });
  }

  const pdfPayload = await resolvePdfDataUrl(args.pdfDataUrl);
  if (pdfPayload && pdfPayload.length < 8_000_000) {
    content.push({
      type: "input_file",
      filename: args.pdfFileName || "glosor.pdf",
      file_data: pdfPayload,
    } as OpenAI.Responses.ResponseInputContent);
  }

  if (
    content.length === 1 &&
    !args.extractedText?.trim()
  ) {
    return null;
  }

  const raw = await createStructuredResponse({
    instructions:
      "You extract bilingual vocabulary lists for school students aged 11–15. Be thorough and accurate. Do not invent words that are not visible.",
    input: [{ role: "user", content }],
    schemaName: "vocab_pairs",
    schema: vocabExtractSchema as unknown as Record<string, unknown>,
  });

  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      pairs?: { term?: string; translation?: string }[];
      languageFrom?: string;
      languageTo?: string;
    };
    const pairs = (parsed.pairs || [])
      .map((p) => ({
        term: String(p.term || "").trim(),
        translation: String(p.translation || "").trim(),
      }))
      .filter((p) => p.term && p.translation);
    if (!pairs.length) return null;
    return {
      pairs,
      languageFrom: parsed.languageFrom?.trim() || undefined,
      languageTo: parsed.languageTo?.trim() || undefined,
    };
  } catch {
    return null;
  }
}

/** Map internal tutor turn → legacy UI fields (feedback/correct) without changing the UI. */
export function toLegacyGradePayload(turn: TutorTurn) {
  return {
    ...turn,
    feedback: turn.student_message,
    correct: turn.evaluation === "correct",
  };
}
