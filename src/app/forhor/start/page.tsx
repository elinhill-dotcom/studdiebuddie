"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { inventQuestionsFromHomework } from "@/lib/invent-questions";
import { loadData, upsertQuiz } from "@/lib/store";
import { notifyDataChanged } from "@/components/useAppData";
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
  const [status, setStatus] = useState("Läser ditt material…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const ids = multiParam
        ? multiParam.split(",").map((s) => s.trim()).filter(Boolean)
        : singleId
          ? [singleId]
          : [];

      if (!ids.length) {
        setError("Ingen läxa vald.");
        return;
      }

      const data = loadData();
      const homeworks = ids
        .map((id) => data.homeworks.find((h) => h.id === id))
        .filter((h): h is Homework => Boolean(h));

      if (!homeworks.length) {
        setError("Läxorna hittades inte.");
        return;
      }

      const usable = homeworks.filter(
        (hw) =>
          Boolean(hw.extractedText?.trim()) ||
          Boolean(hw.description?.trim()) ||
          Boolean(hw.pdfDataUrl),
      );

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

      // Fördela frågor jämnt, max 12 totalt
      const totalTarget = multi ? Math.min(12, usable.length * 3) : 6;
      const perHw = Math.max(2, Math.ceil(totalTarget / usable.length));

      const allQuestions: QuizQuestion[] = [];
      let anyAi = false;

      for (const hw of usable) {
        if (cancelled) return;
        setStatus(`Skapar frågor från “${hw.title}”…`);
        const { questions, source } = await generateForHomework(hw, perHw);
        if (source === "ai") anyAi = true;
        allQuestions.push(...questions);
      }

      if (cancelled) return;

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
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [singleId, multiParam, router]);

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
