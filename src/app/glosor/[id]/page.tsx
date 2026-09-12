"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { notifyDataChanged, useAppData } from "@/components/useAppData";
import { generateVocabQuestions, parseVocabPaste } from "@/lib/ai-quiz";
import {
  compressImageToDataUrl,
  extractTextFromPdf,
  readFileAsDataUrl,
} from "@/lib/pdf";
import {
  deleteVocabList,
  loadData,
  upsertQuiz,
  upsertVocabList,
  upsertHomework,
} from "@/lib/store";
import type { QuizSession, VocabPair, VocabList } from "@/lib/types";
import { VOCAB_GAMES } from "@/lib/vocab-games";
import { HomeworkAttachments, attachmentValueFromHomework } from "@/components/HomeworkAttachments";
import { withMirroredAttachmentFields } from "@/lib/attachments";
import { extractHomeworkVocab } from "@/lib/vocab-material";

export default function GloslistaPage() {
  const { id } = useParams<{ id: string }>();
  const { data, ready } = useAppData();
  if (!ready) return <p>Laddar…</p>;
  const list = data.vocabLists.find(v => v.id === id);
  if (!list) return <p>Listan hittades inte. <Link href="/glosor">Tillbaka</Link></p>;
  return <GloslistaEditor key={id} initialList={list} />;
}

function GloslistaEditor({ initialList }: { initialList: VocabList }) {
  const id = initialList.id;
  const { data, ready, refresh } = useAppData();
  const router = useRouter();
  const list = data.vocabLists.find((v) => v.id === id) || initialList;

  const [title, setTitle] = useState(initialList.title);
  const [languageFrom, setLanguageFrom] = useState(initialList.languageFrom);
  const [languageTo, setLanguageTo] = useState(initialList.languageTo);
  const [pairs, setPairs] = useState<VocabPair[]>(initialList.pairs);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialList.pairs.filter(p => p.term.trim() && p.translation.trim()).map(p => p.id)));
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const linkedIds = new Set(data.reminders.filter(r => r.url === `/glosor/${id}`).map(r => r.homeworkId));
  const linkedHomework = data.homeworks.filter(h => linkedIds.has(h.id));

  const completePairs = useMemo(
    () => pairs.filter((p) => p.term.trim() && p.translation.trim()),
    [pairs],
  );

  const selectedCount = completePairs.filter((p) => selected.has(p.id)).length;

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

  const save = (nextPairs = pairs, nextFrom = languageFrom, nextTo = languageTo) => {
    upsertVocabList({
      ...list,
      title: title.trim() || list.title,
      languageFrom: nextFrom.trim() || list.languageFrom,
      languageTo: nextTo.trim() || list.languageTo,
      pairs: nextPairs,
      updatedAt: new Date().toISOString(),
    });
    notifyDataChanged();
    refresh();
  };

  const addRow = () => {
    const row: VocabPair = {
      id: crypto.randomUUID(),
      term: "",
      translation: "",
    };
    setPairs((p) => [...p, row]);
  };

  const importPaste = () => {
    const parsed = parseVocabPaste(paste);
    if (parsed.length === 0) return;
    const added = parsed.map((p) => ({ id: crypto.randomUUID(), ...p }));
    setPairs((prev) => [
      ...prev.filter((p) => p.term.trim() || p.translation.trim()),
      ...added,
    ]);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const a of added) next.add(a.id);
      return next;
    });
    setPaste("");
  };

  const toggleOne = (pid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(completePairs.map((p) => p.id)));
  };

  const selectNone = () => {
    setSelected(new Set());
  };

  const extractFromFile = async (file: File | null, kind: "image" | "pdf") => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      let photoDataUrl: string | undefined;
      let pdfDataUrl: string | undefined;
      let pdfFileName: string | undefined;
      let extractedText = "";

      if (kind === "pdf") {
        if (file.size > 40_000_000) {
          setError("PDF:en är för stor (max ca 40 MB).");
          return;
        }
        const [dataUrl, text] = await Promise.all([
          readFileAsDataUrl(file),
          extractTextFromPdf(file).catch(() => ""),
        ]);
        pdfDataUrl = dataUrl;
        pdfFileName = file.name;
        extractedText = text;
      } else {
        if (!file.type.startsWith("image/")) {
          setError("Välj en bild.");
          return;
        }
        photoDataUrl = await compressImageToDataUrl(file);
      }

      const res = await fetch("/api/vocab/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoDataUrl,
          pdfDataUrl,
          pdfFileName,
          extractedText,
          languageFrom,
          languageTo,
        }),
      });
      const json = (await res.json()) as {
        pairs?: { term: string; translation: string }[];
        languageFrom?: string;
        languageTo?: string;
        error?: string;
      };
      if (!res.ok || !json.pairs?.length) {
        setError(json.error || "Kunde inte läsa glosorna.");
        return;
      }

      const added: VocabPair[] = json.pairs.map((p) => ({
        id: crypto.randomUUID(),
        term: p.term,
        translation: p.translation,
      }));
      const nextPairs = [
        ...pairs.filter((p) => p.term.trim() || p.translation.trim()),
        ...added,
      ];
      const nextFrom = json.languageFrom || languageFrom;
      const nextTo = json.languageTo || languageTo;
      setPairs(nextPairs);
      if (json.languageFrom) setLanguageFrom(json.languageFrom);
      if (json.languageTo) setLanguageTo(json.languageTo);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const a of added) next.add(a.id);
        return next;
      });
      save(nextPairs, nextFrom, nextTo);
    } catch {
      setError("Kunde inte läsa filen. Försök igen.");
    } finally {
      setBusy(false);
    }
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
    const ids = [...selected];
    const questions = generateVocabQuestions(current, undefined, ids);
    if (questions.length === 0) {
      alert("Bocka i minst en glosa att öva på.");
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
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/glosor" className="text-sm text-muted hover:text-ink">
        ← Alla gloslistor
      </Link>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="label">Öva som du vill</p>
            <h1 className="font-display text-3xl">Glosförhör och spel</h1>
          </div>
          <span className="tag">{selectedCount} ord valda</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="game-picker game-coral"
            disabled={selectedCount === 0 || busy}
            onClick={startQuiz}
          >
            <span className="game-symbol" aria-hidden>?</span>
            <span className="font-display mt-4 block text-2xl">Glosförhör</span>
            <span className="mt-2 block text-sm text-ink-soft">
              Vanligt förhör — skriv svaret, en glosa i taget.
            </span>
            <span className="mt-5 block text-sm font-semibold">Starta →</span>
          </button>
          {VOCAB_GAMES.map((game) => (
            <button
              key={game.id}
              type="button"
              className={`game-picker game-${game.tint}`}
              disabled={selectedCount === 0 || busy}
              onClick={() => {
                save();
                router.push(`/glosor/${id}/spel?game=${game.id}&words=${[...selected].join(",")}`);
              }}
            >
              <span className="game-symbol" aria-hidden>{game.icon}</span>
              <span className="font-display mt-4 block text-2xl">{game.name}</span>
              <span className="mt-2 block text-sm text-ink-soft">{game.description}</span>
              <span className="mt-5 block text-sm font-semibold">Spela →</span>
            </button>
          ))}
        </div>
        {!selectedCount && (
          <p className="text-sm text-muted">
            Lägg till eller välj glosor nedan för att öppna förhör och spel.
          </p>
        )}
        <p className="text-sm text-muted">
          {data.quizSessions.filter((s) => s.vocabListId === id && s.finishedAt).length} avslutade träningspass med den här listan.
        </p>
        <Link className="text-sm text-sage underline" href={`/paminnelser?vocab=${id}`}>
          Påminn mig att träna de här glosorna
        </Link>
      </section>

      {linkedHomework.map(hw => <section className="panel space-y-3 p-5" key={hw.id}>
        <h2 className="font-display text-xl">Material till {hw.title}</h2><p className="text-sm text-muted">Fota pappret eller lägg till bild/PDF nu eller senare. Materialet sparas på den kopplade läxan.</p>
        <HomeworkAttachments value={attachmentValueFromHomework(hw)} onChange={patch => { upsertHomework(withMirroredAttachmentFields({ ...hw, ...patch })); notifyDataChanged(); }} />
        <button className="btn-secondary" disabled={busy} onClick={async () => {
          setBusy(true); setError("");
          try { const added = await extractHomeworkVocab(hw, languageFrom, languageTo); const seen = new Set(pairs.map(p => `${p.term.toLocaleLowerCase()}|${p.translation.toLocaleLowerCase()}`)); const fresh = added.filter(p => !seen.has(`${p.term.toLocaleLowerCase()}|${p.translation.toLocaleLowerCase()}`)); const next = [...pairs.filter(p => p.term.trim() || p.translation.trim()), ...fresh]; setPairs(next); setSelected(s => new Set([...s, ...fresh.map(p => p.id)])); save(next); }
          catch (e) { setError(e instanceof Error ? e.message : "Kunde inte läsa glosorna."); }
          finally { setBusy(false); }
        }}>{busy ? "Läser materialet…" : "Läs in glosor från materialet"}</button>
        <Link href={`/laxor/${hw.id}`} className="ml-3 text-sm text-sage underline">Öppna läxan</Link>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </section>)}

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

        <div className="space-y-2 rounded-xl bg-white/60 p-3">
          <p className="label mb-0">Ladda upp gloslista</p>
          <p className="text-xs text-muted">
            Ta foto, välj bild eller PDF — Buddie läser in orden automatiskt.
          </p>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="fixed left-[-9999px] top-0 h-px w-px opacity-0"
            onChange={(e) => {
              void extractFromFile(e.target.files?.[0] ?? null, "image");
              e.target.value = "";
            }}
          />
          <input
            ref={libraryRef}
            type="file"
            accept="image/*"
            className="fixed left-[-9999px] top-0 h-px w-px opacity-0"
            onChange={(e) => {
              void extractFromFile(e.target.files?.[0] ?? null, "image");
              e.target.value = "";
            }}
          />
          <input
            ref={pdfRef}
            type="file"
            accept="application/pdf,.pdf"
            className="fixed left-[-9999px] top-0 h-px w-px opacity-0"
            onChange={(e) => {
              void extractFromFile(e.target.files?.[0] ?? null, "pdf");
              e.target.value = "";
            }}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              className="btn-secondary py-2 text-sm"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
            >
              Ta foto
            </button>
            <button
              type="button"
              className="btn-secondary py-2 text-sm"
              disabled={busy}
              onClick={() => libraryRef.current?.click()}
            >
              Bildbibliotek
            </button>
            <button
              type="button"
              className="btn-secondary py-2 text-sm"
              disabled={busy}
              onClick={() => pdfRef.current?.click()}
            >
              Välj PDF
            </button>
          </div>
          {busy && (
            <p className="text-sm text-muted">Läser gloslistan…</p>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="label mb-0">
              Glosor · {selectedCount} av {completePairs.length} valda
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={selectAll}
              >
                Alla
              </button>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={selectNone}
              >
                Ingen
              </button>
            </div>
          </div>
          <p className="text-xs text-muted">
            Alla är förvalda — bocka av dem du inte vill öva på nu.
          </p>

          {pairs.map((p, i) => {
            const complete = Boolean(p.term.trim() && p.translation.trim());
            return (
              <div
                key={p.id}
                className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--coral)]"
                  checked={complete && selected.has(p.id)}
                  disabled={!complete}
                  onChange={() => toggleOne(p.id)}
                  aria-label={`Öva på ${p.term || "glosa"}`}
                />
                <input
                  className="input-field py-2 text-sm"
                  value={p.term}
                  placeholder={languageFrom || "Ord"}
                  onChange={(e) => {
                    const next = [...pairs];
                    next[i] = { ...p, term: e.target.value };
                    setPairs(next);
                    if (e.target.value.trim() && p.translation.trim()) {
                      setSelected((s) => new Set(s).add(p.id));
                    }
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
                    if (p.term.trim() && e.target.value.trim()) {
                      setSelected((s) => new Set(s).add(p.id));
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-ghost text-danger"
                  onClick={() => {
                    setPairs(pairs.filter((x) => x.id !== p.id));
                    setSelected((s) => {
                      const n = new Set(s);
                      n.delete(p.id);
                      return n;
                    });
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
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
          <button
            type="button"
            className="btn-primary"
            onClick={startQuiz}
            disabled={selectedCount === 0 || busy}
          >
            Starta glosförhör ({selectedCount})
          </button>
          <button type="button" className="btn-secondary" onClick={() => save()}>
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
