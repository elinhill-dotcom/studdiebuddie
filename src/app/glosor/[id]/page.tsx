"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { notifyDataChanged, useAppData } from "@/components/useAppData";
import { generateVocabQuestions, parseVocabPaste } from "@/lib/ai-quiz";
import {
  deleteVocabList,
  loadData,
  upsertQuiz,
  upsertVocabList,
} from "@/lib/store";
import type { QuizSession, VocabPair } from "@/lib/types";

export default function GloslistaPage() {
  const { id } = useParams<{ id: string }>();
  const { data, ready, refresh } = useAppData();
  const router = useRouter();
  const list = data.vocabLists.find((v) => v.id === id);

  const [title, setTitle] = useState("");
  const [languageFrom, setLanguageFrom] = useState("");
  const [languageTo, setLanguageTo] = useState("");
  const [pairs, setPairs] = useState<VocabPair[]>([]);
  const [paste, setPaste] = useState("");

  useEffect(() => {
    if (list) {
      setTitle(list.title);
      setLanguageFrom(list.languageFrom);
      setLanguageTo(list.languageTo);
      setPairs(list.pairs);
    }
  }, [list]);

  if (!ready) return <p className="text-muted">Laddar…</p>;
  if (!list) {
    return (
      <div className="panel p-6">
        <p>Listan hittades inte.</p>
        <Link href="/glosor" className="btn-secondary mt-3 inline-flex">
          Tillbaka
        </Link>
      </div>
    );
  }

  const save = () => {
    upsertVocabList({
      ...list,
      title: title.trim() || list.title,
      languageFrom: languageFrom.trim() || list.languageFrom,
      languageTo: languageTo.trim() || list.languageTo,
      pairs,
      updatedAt: new Date().toISOString(),
    });
    notifyDataChanged();
    refresh();
  };

  const addRow = () => {
    setPairs((p) => [
      ...p,
      { id: crypto.randomUUID(), term: "", translation: "" },
    ]);
  };

  const importPaste = () => {
    const parsed = parseVocabPaste(paste);
    if (parsed.length === 0) return;
    setPairs((prev) => [
      ...prev.filter((p) => p.term.trim() || p.translation.trim()),
      ...parsed.map((p) => ({ id: crypto.randomUUID(), ...p })),
    ]);
    setPaste("");
  };

  const startQuiz = () => {
    save();
    const current = loadData().vocabLists.find((v) => v.id === id) || {
      ...list,
      pairs,
      title,
      languageFrom,
      languageTo,
    };
    const questions = generateVocabQuestions(current);
    if (questions.length === 0) {
      alert("Lägg in minst en glosa först.");
      return;
    }
    const session: QuizSession = {
      id: crypto.randomUUID(),
      homeworkIds: [],
      vocabListId: current.id,
      mode: "vocab",
      title: `Glosförhör: ${current.title}`,
      questions,
      answers: [],
      startedAt: new Date().toISOString(),
    };
    upsertQuiz(session);
    notifyDataChanged();
    router.push(`/forhor/${session.id}`);
  };

  const remove = () => {
    if (!confirm("Ta bort gloslistan?")) return;
    deleteVocabList(list.id);
    notifyDataChanged();
    router.push("/glosor");
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href="/glosor" className="text-sm text-muted hover:text-ink">
        ← Alla gloslistor
      </Link>

      <div className="panel space-y-4 p-5">
        <input
          className="input-field border-0 bg-transparent px-0 font-display text-2xl font-semibold shadow-none focus:shadow-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Från</label>
            <input
              className="input-field"
              value={languageFrom}
              onChange={(e) => setLanguageFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Till</label>
            <input
              className="input-field"
              value={languageTo}
              onChange={(e) => setLanguageTo(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="label mb-0">Glosor</p>
          {pairs.map((p, i) => (
            <div key={p.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                className="input-field py-2 text-sm"
                value={p.term}
                placeholder={languageFrom || "Ord"}
                onChange={(e) => {
                  const next = [...pairs];
                  next[i] = { ...p, term: e.target.value };
                  setPairs(next);
                }}
              />
              <input
                className="input-field py-2 text-sm"
                value={p.translation}
                placeholder={languageTo || "Översättning"}
                onChange={(e) => {
                  const next = [...pairs];
                  next[i] = { ...p, translation: e.target.value };
                  setPairs(next);
                }}
              />
              <button
                type="button"
                className="btn-ghost text-danger"
                onClick={() => setPairs(pairs.filter((x) => x.id !== p.id))}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn-secondary text-sm" onClick={addRow}>
            + Rad
          </button>
        </div>

        <div>
          <label className="label">Klistra in fler</label>
          <textarea
            className="input-field min-h-20 font-mono text-sm"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="word - översättning"
          />
          <button
            type="button"
            className="btn-ghost mt-1 text-sm"
            onClick={importPaste}
          >
            Importera rader
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="btn-primary" onClick={startQuiz}>
            Starta glosförhör
          </button>
          <button type="button" className="btn-secondary" onClick={save}>
            Spara
          </button>
          <button type="button" className="btn-ghost text-danger" onClick={remove}>
            Ta bort
          </button>
        </div>
      </div>
    </div>
  );
}
