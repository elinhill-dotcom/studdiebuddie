"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { inventQuestionsFromHomework } from "@/lib/invent-questions";
import { hasHomeworkFiles, hasQuizMaterial } from "@/lib/helpers";
import { loadData, upsertHomework, upsertQuiz } from "@/lib/store";
import { notifyDataChanged } from "@/components/useAppData";
import { HomeworkAttachments } from "@/components/HomeworkAttachments";
import type { Homework, QuizQuestion, QuizSession } from "@/lib/types";
import Link from "next/link";

async function generateForHomework(
  hw: Homework,
  count: number,
): Promise<{ questions: QuizQuestion[]; source: string }> {
  try {
    const res = await fetch("/api/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homework: hw, count }),
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
    questions: inventQuestionsFromHomework(hw, count),
    source: "local",
  };
}

function StartInner() {
  const params = useSearchParams();
  const singleId = params.get("homework");
  const multiParam = params.get("homeworks");
  const router = useRouter();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Förbereder…");
  const [needsUpload, setNeedsUpload] = useState<Homework | null>(null);
  const [uploadPatch, setUploadPatch] = useState({
    photoDataUrl: undefined as string | undefined,
    pdfDataUrl: undefined as string | undefined,
    pdfFileName: undefined as string | undefined,
    extractedText: "",
  });
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

      // Erbjud filuppladdning om foto/PDF saknas (kan hoppas över)
      const missing = homeworks.find(
        (hw) => !hasHomeworkFiles(hw) && !skippedUpload.current.has(hw.id),
      );
      if (missing) {
        setPendingIds(ids);
        setNeedsUpload(missing);
        setUploadPatch({
          photoDataUrl: missing.photoDataUrl,
          pdfDataUrl: missing.pdfDataUrl,
          pdfFileName: missing.pdfFileName,
          extractedText: missing.extractedText || "",
        });
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

      const totalTarget = multi ? Math.min(12, usable.length * 3) : 6;
      const perHw = Math.max(2, Math.ceil(totalTarget / usable.length));

      const allQuestions: QuizQuestion[] = [];
      let anyAi = false;

      for (const hw of usable) {
        setStatus(`Skapar frågor från “${hw.title}”…`);
        const { questions, source } = await generateForHomework(hw, perHw);
        if (source === "ai") anyAi = true;
        allQuestions.push(...questions);
      }

      const questions = allQuestions.slice(0, multi ? 12 : 6);
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
        mode: multi ? "summary" : "single",
        title,
        questions,
        answers: [],
        startedAt: new Date().toISOString(),
      };
      upsertQuiz(session);
      notifyDataChanged();
      setStatus(
        anyAi
          ? "Klart — startar chatten…"
          : "Klart (lokala frågor) — startar chatten…",
      );
      router.replace(`/forhor/${session.id}`);
    },
    [router],
  );

  useEffect(() => {
    if (started.current) return;
    const ids = multiParam
      ? multiParam.split(",").map((s) => s.trim()).filter(Boolean)
      : singleId
        ? [singleId]
        : [];

    if (!ids.length) {
      setError("Ingen läxa vald.");
      return;
    }
    started.current = true;
    void runQuiz(ids);
  }, [singleId, multiParam, runQuiz]);

  const saveUploadAndContinue = () => {
    if (!needsUpload || !pendingIds) return;
    if (!uploadPatch.photoDataUrl && !uploadPatch.pdfDataUrl && !uploadPatch.extractedText.trim()) {
      setError("Ladda upp en fil eller skriv in text innan du fortsätter.");
      return;
    }
    const text =
      uploadPatch.extractedText.trim() ||
      needsUpload.description.trim() ||
      `Läxa: ${needsUpload.title}. Ämne: ${needsUpload.subject}.`;
    upsertHomework({
      ...needsUpload,
      photoDataUrl: uploadPatch.photoDataUrl,
      pdfDataUrl: uploadPatch.pdfDataUrl,
      pdfFileName: uploadPatch.pdfFileName,
      extractedText: text,
    });
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
            onChange={(next) =>
              setUploadPatch({
                photoDataUrl: next.photoDataUrl,
                pdfDataUrl: next.pdfDataUrl,
                pdfFileName: next.pdfFileName,
                extractedText: next.extractedText,
              })
            }
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

  if (error) {
    return (
      <div className="panel p-6">
        <p className="font-semibold text-danger">{error}</p>
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
