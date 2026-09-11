"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { inventQuestionsFromHomework } from "@/lib/invent-questions";
import { loadData, upsertQuiz } from "@/lib/store";
import { notifyDataChanged } from "@/components/useAppData";
import type { QuizQuestion, QuizSession } from "@/lib/types";
import Link from "next/link";

function StartInner() {
  const params = useSearchParams();
  const homeworkId = params.get("homework");
  const router = useRouter();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Läser ditt material…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!homeworkId) {
        setError("Ingen läxa vald.");
        return;
      }
      const data = loadData();
      const hw = data.homeworks.find((h) => h.id === homeworkId);
      if (!hw) {
        setError("Läxan hittades inte.");
        return;
      }

      const hasMaterial =
        Boolean(hw.extractedText?.trim()) ||
        Boolean(hw.description?.trim()) ||
        Boolean(hw.photoDataUrl);

      if (!hasMaterial) {
        setError(
          "Lägg till text eller foto på läxan först, så Buddie kan hitta på frågor.",
        );
        return;
      }

      setStatus("Buddie hittar på frågor utifrån ditt material…");

      let questions: QuizQuestion[] = [];
      let source = "local";

      try {
        // Skicka inte jättestora foton om det inte behövs — men behåll foto för vision
        const payload = {
          homework: hw,
          count: 6,
        };
        const res = await fetch("/api/quiz/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            questions: QuizQuestion[];
            source: string;
          };
          questions = json.questions || [];
          source = json.source;
        }
      } catch {
        // fall through to local
      }

      if (!questions.length) {
        questions = inventQuestionsFromHomework(hw, 6);
        source = "local";
      }

      if (cancelled) return;

      const session: QuizSession = {
        id: crypto.randomUUID(),
        homeworkIds: [hw.id],
        mode: "single",
        title: `Förhör: ${hw.title}`,
        questions,
        answers: [],
        startedAt: new Date().toISOString(),
      };
      upsertQuiz(session);
      notifyDataChanged();
      setStatus(
        source === "ai"
          ? "Klart — startar chatten…"
          : "Klart (lokala frågor) — startar chatten…",
      );
      router.replace(`/forhor/${session.id}`);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [homeworkId, router]);

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
        Frågor utifrån uppladdat material — utan facit i chatten.
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
