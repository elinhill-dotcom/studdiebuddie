"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { inventQuestionsFromHomework } from "@/lib/invent-questions";
import { hasHomeworkFiles, hasQuizMaterial } from "@/lib/helpers";
import { withMirroredAttachmentFields } from "@/lib/attachments";
import { loadData, upsertHomework, upsertQuiz } from "@/lib/store";
import { notifyDataChanged } from "@/components/useAppData";
import {
  HomeworkAttachments,
  attachmentValueFromHomework,
} from "@/components/HomeworkAttachments";
import type {
  Homework,
  HomeworkAttachment,
  QuizQuestion,
  QuizSession,
} from "@/lib/types";
import Link from "next/link";
import { homeworkPractice } from "@/lib/practice";
import { practiceBatches, type PracticeFormat } from "@/lib/practice-material";
import { combinedAttachmentText, normalizeAttachments } from "@/lib/attachments";

async function generateForHomework(
  hw: Homework,
  count: number,
  format: PracticeFormat,
): Promise<{ questions: QuizQuestion[]; source: string }> {
  try {
    const res = await fetch("/api/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ homework: hw, count, format }),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        questions: QuizQuestion[];
        source: string;
      };
      if (json.questions?.length) {
        return { questions: json.questions, source: json.source || "ai" };
      }
    }
  } catch {
    // fall through
  }
  return {
    questions: inventQuestionsFromHomework(hw, count, format),
    source: "local",
  };
}

function StartInner() {
  const params = useSearchParams();
  const singleId = params.get("homework");
  const multiParam = params.get("homeworks");
  const format = params.get("format");
  const focus = params.get("focus") === "weak";
  const router = useRouter();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Förbereder…");
  const [needsUpload, setNeedsUpload] = useState<Homework | null>(null);
  const [uploadPatch, setUploadPatch] = useState<{
    attachments: HomeworkAttachment[];
    extractedText: string;
  }>({ attachments: [], extractedText: "" });
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const skippedUpload = useRef(new Set<string>());
  const started = useRef(false);

  const runQuiz = useCallback(
    async (ids: string[]) => {
      setNeedsUpload(null);
      setError("");
      setStatus("Läser ditt material…");

      const data = loadData();
      const homeworks = ids
        .map((id) => data.homeworks.find((h) => h.id === id))
        .filter((h): h is Homework => Boolean(h));

      if (!homeworks.length) {
        setError("Läxorna hittades inte.");
        return;
      }

      if (focus) {
        const questions = homeworks.flatMap(hw => homeworkPractice(data.quizSessions, hw.id).weakQuestions.map(q => ({ ...q, id: crypto.randomUUID(), homeworkId: hw.id })));
        if (!questions.length) {
          setError("Det finns inga sparade träningsområden ännu. Starta ett vanligt förhör först.");
          return;
        }
        const session: QuizSession = {
          id: crypto.randomUUID(), homeworkIds: ids, mode: format === "exam" || format === "flashcards" ? format : "retry",
          title: `Träna mer: ${homeworks.map(h => h.title).join(", ")}`, questions, answers: [], startedAt: new Date().toISOString(),
        };
        upsertQuiz(session);
        notifyDataChanged();
        router.replace(`/forhor/${session.id}`);
        return;
      }

      // Erbjud filuppladdning om foto/PDF saknas (kan hoppas över)
      const missing = homeworks.find(
        (hw) => !hasHomeworkFiles(hw) && !skippedUpload.current.has(hw.id),
      );
      if (missing) {
        setPendingIds(ids);
        setNeedsUpload(missing);
        setUploadPatch(attachmentValueFromHomework(missing));
        return;
      }

      const usable = homeworks.filter(hasQuizMaterial);
      if (!usable.length) {
        setError(
          "Lägg till text, foto eller PDF på läxorna först, så Buddie kan hitta på frågor.",
        );
        return;
      }

      const multi = usable.length > 1;
      setStatus(
        multi
          ? `Buddie läser ${usable.length} läxor och hittar på frågor…`
          : "Buddie hittar på frågor utifrån ditt material…",
      );

      const allQuestions: QuizQuestion[] = [];
      let anyAi = false;
      const practiceFormat: PracticeFormat = format === "exam" || format === "flashcards" ? format : "chat";

      for (const hw of usable) {
        const text = [hw.description, combinedAttachmentText(hw)].filter(Boolean).join("\n\n");
        const batches = practiceBatches(text, practiceFormat);
        const attachments = normalizeAttachments(hw);
        // A photographed homework has almost no text to split. Keep all pages,
        // and ask questions in image batches instead of falling back to 3.
        const visualOnly = attachments.some(a => a.kind === "image") &&
          text.replace(/^Läxa:.*?Ämne:.*?(\n|$)/, "").trim().length < 200;
        const sections = visualOnly
          ? Array.from({ length: Math.ceil(attachments.length / 6) }, (_, index) => ({
              text: "",
              count: Math.max(4, Math.ceil(Math.min(6, attachments.length - index * 6) * 4)),
              attachments: attachments.slice(index * 6, index * 6 + 6),
            }))
          : batches.length > 1 ? batches : [{ text, count: batches[0]?.count || 12 }];
        for (let part = 0; part < sections.length; part++) {
          setStatus(`Läser “${hw.title}”, del ${part + 1} av ${sections.length}. ${allQuestions.length} frågor skapade…`);
          const section = sections[part];
          const sourceHomework: Homework = sections.length > 1 ? {
            ...hw, description: "", extractedText: section.text, attachments: "attachments" in section ? section.attachments as HomeworkAttachment[] : [], photoDataUrl: undefined, pdfDataUrl: undefined, pdfFileName: undefined,
          } : hw;
          const { questions, source } = await generateForHomework(sourceHomework, section.count, practiceFormat);
          if (source === "ai") anyAi = true;
          allQuestions.push(...questions.map(q => ({ ...q, homeworkId: hw.id })));
        }
      }

      const seen = new Set<string>();
      const questions = allQuestions.filter(q => {
        const key = `${q.homeworkId}:${q.prompt.trim().toLocaleLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (!questions.length) {
        setError("Kunde inte skapa frågor. Försök igen.");
        return;
      }

      const title = multi
        ? `Stort förhör: ${usable.length} läxor${
            usable.every((h) => h.subject === usable[0].subject)
              ? ` (${usable[0].subject})`
              : ""
          }`
        : `Förhör: ${usable[0].title}`;

      const session: QuizSession = {
        id: crypto.randomUUID(),
        homeworkIds: usable.map((h) => h.id),
        mode: format === "exam" || format === "flashcards" ? format : multi ? "summary" : "single",
        title,
        questions,
        answers: [],
        startedAt: new Date().toISOString(),
      };
      upsertQuiz(session);
      notifyDataChanged();
      setStatus(
        anyAi
          ? `Klart — startar med ${questions.length} frågor…`
          : `Klart — startar med ${questions.length} lokala övningsfrågor…`,
      );
      router.replace(`/forhor/${session.id}`);
    },
    [router, format, focus],
  );

  useEffect(() => {
    if (started.current) return;
    const ids = multiParam
      ? multiParam.split(",").map((s) => s.trim()).filter(Boolean)
      : singleId
        ? [singleId]
        : [];

    if (!ids.length) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (started.current) return;
      started.current = true;
      void runQuiz(ids);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [singleId, multiParam, runQuiz]);

  const saveUploadAndContinue = () => {
    if (!needsUpload || !pendingIds) return;
    if (
      uploadPatch.attachments.length === 0 &&
      !uploadPatch.extractedText.trim()
    ) {
      setError("Ladda upp minst en fil eller skriv in text innan du fortsätter.");
      return;
    }
    upsertHomework(
      withMirroredAttachmentFields({
        ...needsUpload,
        attachments: uploadPatch.attachments,
        extractedText: uploadPatch.extractedText,
      }),
    );
    notifyDataChanged();
    skippedUpload.current.add(needsUpload.id);
    void runQuiz(pendingIds);
  };

  const skipUpload = () => {
    if (!needsUpload || !pendingIds) return;
    skippedUpload.current.add(needsUpload.id);
    void runQuiz(pendingIds);
  };

  if (needsUpload) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="panel space-y-4 p-5 sm:p-6">
          <h1 className="font-display text-2xl font-medium tracking-tight">
            Ladda upp material
          </h1>
          <p className="text-sm text-ink-soft">
            “{needsUpload.title}” har ingen foto/PDF ännu. Ladda upp nu — eller
            fortsätt utan fil om beskrivningen räcker.
          </p>
          <HomeworkAttachments
            value={uploadPatch}
            onChange={setUploadPatch}
            optionalHint={false}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={saveUploadAndContinue}
            >
              Spara och starta
            </button>
            <button type="button" className="btn-secondary" onClick={skipUpload}>
              Fortsätt utan fil
            </button>
            <Link href="/forhor" className="btn-ghost">
              Avbryt
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || (!singleId && !multiParam)) {
    return (
      <div className="panel p-6">
        <p className="font-semibold text-danger">{error || "Ingen läxa vald."}</p>
        <Link href="/forhor" className="btn-secondary mt-3 inline-flex">
          Tillbaka
        </Link>
      </div>
    );
  }

  return (
    <div className="panel px-8 py-10 text-center">
      <p className="font-display animate-rise text-2xl font-medium">{status}</p>
      <p className="mt-2 text-muted">
        Frågor utifrån sparade läxor — utan facit i chatten.
      </p>
    </div>
  );
}

export default function ForhorStartPage() {
  return (
    <Suspense fallback={<p>Startar…</p>}>
      <StartInner />
    </Suspense>
  );
}
