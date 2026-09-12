"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { answerOptions, gamePairs, mixedLetters, shuffle, VOCAB_GAMES, wordKey, type VocabGame } from "@/lib/vocab-games";
import type { QuizAttemptAnswer, QuizSession, VocabList, VocabPair } from "@/lib/types";
import { upsertQuiz } from "@/lib/store";
import { notifyDataChanged } from "./useAppData";

export function VocabGames({ list, game, onProgress }: { list: VocabList; game: VocabGame; onProgress?: (session: QuizSession) => void }) {
  const [round, setRound] = useState(0);
  const [onlyWeak, setOnlyWeak] = useState<string[] | null>(null);
  return <GameRound key={`${game}-${round}`} list={list} game={game} onlyWeak={onlyWeak} onProgress={onProgress} restart={weak => { setOnlyWeak(weak); setRound(n => n + 1); }} />;
}

function GameRound({ list, game, onlyWeak, restart, onProgress }: { list: VocabList; game: VocabGame; onlyWeak: string[] | null; restart: (weak: string[] | null) => void; onProgress?: (session: QuizSession) => void }) {
  const [pairs] = useState(() => shuffle(gamePairs(list.pairs.filter(p => !onlyWeak || onlyWeak.includes(p.id)), game)));
  const [answers, setAnswers] = useState<QuizAttemptAnswer[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [startedAt] = useState(() => new Date().toISOString());
  const [finished, setFinished] = useState(false);
  const definition = VOCAB_GAMES.find(g => g.id === game)!;
  const weak = answers.filter(a => !a.correct).map(a => a.questionId);
  const correct = answers.filter(a => a.correct).length;
  function record(pair: VocabPair, correct: boolean, userAnswer: string) {
    const next = [...answers.filter(a => a.questionId !== pair.id), { questionId: pair.id, userAnswer, correct, needsPractice: !correct }];
    const done = next.length === pairs.length;
    setAnswers(next);
    setFinished(done);
    const session: QuizSession = { id: sessionId, vocabListId: list.id, homeworkIds: [], mode: "vocab", title: `${definition.name}: ${list.title}`, startedAt,
      questions: pairs.map(p => ({ id: p.id, prompt: game === "scramble" ? p.translation : p.term, expectedAnswer: game === "scramble" ? p.term : p.translation, topic: p.term })), answers: next,
      ...(done ? { finishedAt: new Date().toISOString(), scorePercent: Math.round(next.filter(a => a.correct).length / next.length * 100) } : {}),
    };
    if (onProgress) onProgress(session);
    else { upsertQuiz(session); notifyDataChanged(); }
  }
  return <div className="mx-auto max-w-3xl space-y-5">
    <Link className="text-sm text-muted" href={`/glosor/${list.id}`}>← Till gloslistan</Link>
    <header className={`game-hero game-${definition.tint}`}>
      <div className="game-symbol" aria-hidden>{definition.icon}</div>
      <div><p className="text-xs font-semibold uppercase tracking-widest text-muted">Spela & lär · {list.languageFrom} / {list.languageTo}</p><h1 className="font-display mt-2 text-3xl sm:text-4xl">{definition.name}</h1><p className="mt-2 text-ink-soft">{list.title} · {definition.description}</p></div>
    </header>
    {!pairs.length ? <div className="panel p-6">Lägg till kompletta glosor i listan för att spela.</div> : finished ? <section className="game-result panel space-y-5 p-8 text-center">
      <span className="game-celebration" aria-hidden>✦</span>
      <h2 className="font-display text-3xl">Snyggt, hela rundan klar!</h2>
      <p>{correct} av {pairs.length} ord satt {game === "memory" ? "utan felparning" : "på första försöket"}.</p>
      {weak.length > 0 ? <div className="rounded-2xl bg-brass-soft/50 p-4"><p className="mb-2 font-medium">De här orden tar vi en gång till</p><div className="flex flex-wrap justify-center gap-2">{pairs.filter(p => weak.includes(p.id)).map(p => <span className="tag" key={p.id}>{p.term} → {p.translation}</span>)}</div></div> : <p className="text-sage">Alla ord satt! Byt spel för en ny utmaning.</p>}
      <div className="flex flex-wrap justify-center gap-3">{weak.length > 0 && <button className="btn-primary" onClick={() => restart(weak)}>Öva svåra ord</button>}<button className="btn-secondary" onClick={() => restart(null)}>Spela igen</button><Link className="btn-ghost" href={`/glosor/${list.id}`}>Välj ett annat spel</Link></div>
    </section> : <>
      <div className="flex justify-between text-sm text-muted"><span>{answers.length} av {pairs.length} ord tränade</span><span>I din takt ♡</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-sage transition-[width] duration-500" style={{ width: `${answers.length / pairs.length * 100}%` }} /></div>
      {game === "memory" ? <Memory pairs={pairs} onMatch={record} /> : <WordQuestion key={answers.length} pair={pairs[answers.length]} pairs={pairs} game={game} onAnswer={record} language={list.languageFrom} />}
      <p className="text-center text-xs text-muted">Resultatet sparas i din träningshistorik. Du kan alltid lämna spelet via gloslistan.</p>
    </>}
  </div>;
}

function Memory({ pairs, onMatch }: { pairs: VocabPair[]; onMatch: (pair: VocabPair, correct: boolean, answer: string) => void }) {
  const [page, setPage] = useState(0);
  return <MemoryBoard key={page} pairs={pairs.slice(page * 6, page * 6 + 6)} page={page} pages={Math.ceil(pairs.length / 6)} onMatch={onMatch} next={() => setPage(p => p + 1)} />;
}
function MemoryBoard({ pairs, page, pages, onMatch, next }: { pairs: VocabPair[]; page: number; pages: number; onMatch: (pair: VocabPair, correct: boolean, answer: string) => void; next: () => void }) {
  const [cards] = useState(() => shuffle(pairs.flatMap(p => [{ id: `${p.id}-term`, pair: p, side: "term", text: p.term }, { id: `${p.id}-translation`, pair: p, side: "translation", text: p.translation }])));
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const mismatch = flipped.length === 2;
  function flip(id: string) {
    if (mismatch || flipped.includes(id)) return;
    const card = cards.find(c => c.id === id)!;
    if (matched.includes(card.pair.id)) return;
    if (!flipped.length) { setFlipped([id]); return; }
    const previous = cards.find(c => c.id === flipped[0])!;
    setMoves(n => n + 1);
    if (previous.pair.id === card.pair.id && previous.side !== card.side) {
      setMatched(m => [...m, card.pair.id]); setFlipped([]);
      onMatch(card.pair, !missed.has(card.pair.id), `${card.pair.term} → ${card.pair.translation}`);
    } else { setFlipped([flipped[0], id]); setMissed(m => new Set([...m, previous.pair.id, card.pair.id])); }
  }
  return <section className="panel space-y-4 p-4 sm:p-6">
    <div className="flex justify-between text-sm"><span>Bricka {page + 1} av {pages}</span><span>{moves} försök · {matched.length}/{pairs.length} par</span></div>
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">{cards.map((c, index) => {
      const found = matched.includes(c.pair.id), visible = found || flipped.includes(c.id);
      return <button key={c.id} className={`memory-card ${visible ? "is-flipped" : ""} ${found ? "is-matched" : ""}`} onClick={() => flip(c.id)} disabled={found || (mismatch && !visible)} aria-label={visible ? `${c.text}${found ? ", hittat par" : ""}` : `Vänd kort ${index + 1}`} aria-pressed={visible}>
        <span className="memory-card-inner"><span className="memory-front" aria-hidden>✦</span><span className="memory-back" aria-hidden={!visible}>{visible ? c.text : ""}{found && <span className="mt-1 text-xs">✓</span>}</span></span>
      </button>;
    })}</div>
    <div aria-live="polite" className="min-h-12 text-center text-sm">{mismatch ? <><p>Inte ett par ännu. Titta på orden och försök igen.</p><button className="btn-secondary mt-2 text-sm" onClick={() => setFlipped([])}>Vänd tillbaka</button></> : matched.length === pairs.length ? page + 1 < pages && <button className="btn-primary" onClick={next}>Nästa bricka →</button> : <p className="text-muted">Hitta ett ord och dess översättning.</p>}</div>
  </section>;
}

function WordQuestion({ pair, pairs, game, language, onAnswer }: { pair: VocabPair; pairs: VocabPair[]; game: "choice" | "scramble"; language: string; onAnswer: (pair: VocabPair, correct: boolean, answer: string) => void }) {
  const [options] = useState(() => answerOptions(pair, pairs));
  const [letters] = useState(() => mixedLetters(pair.term));
  const [used, setUsed] = useState<number[]>([]);
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<null | boolean>(null);
  const [attempts, setAttempts] = useState(0);
  const [shown, setShown] = useState(false);
  const [choice, setChoice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (game === "scramble") input.current?.focus(); }, [game]);
  const expected = game === "choice" ? pair.translation : pair.term;
  function check(answer: string) {
    if (feedback === true || shown) return;
    setChoice(answer); setAttempts(n => n + 1); setFeedback(wordKey(answer) === wordKey(expected));
  }
  return <section className="panel space-y-6 p-5 sm:p-8">
    <div className="text-center"><p className="text-sm text-muted">{game === "choice" ? "Vad betyder ordet?" : `Bygg ordet på ${language}`}</p><h2 className="font-display mt-3 break-words text-3xl sm:text-4xl">{game === "choice" ? pair.term : pair.translation}</h2></div>
    {game === "choice" ? <div className="grid gap-3 sm:grid-cols-2">{options.map((option, i) => <button className={`word-option ${choice === option ? feedback ? "answer-right" : "answer-retry" : ""}`} key={option} onClick={() => check(option)} disabled={feedback === true || shown}><span className="option-number">{i + 1}</span><span>{option}</span></button>)}</div> : <form onSubmit={e => { e.preventDefault(); check(typed); }} className="space-y-4">
      <label className="block"><span className="sr-only">Ditt ord</span><input ref={input} className="input-field text-center text-xl" value={typed} onChange={e => { setTyped(e.target.value); setUsed([]); setFeedback(null); }} autoComplete="off" spellCheck={false} disabled={feedback === true || shown} placeholder="Tryck på bokstäverna eller skriv…" /></label>
      <div className="flex flex-wrap justify-center gap-2">{letters.map((letter, i) => <button type="button" className="letter-tile" key={i} disabled={used.includes(i) || feedback === true || shown} aria-label={letter === " " ? "Mellanslag" : letter} onClick={() => { setUsed(u => [...u, i]); setTyped(t => t + letter); setFeedback(null); }}>{letter === " " ? "␣" : letter}</button>)}</div>
      <div className="flex justify-center gap-2"><button className="btn-primary" disabled={!typed.trim() || feedback === true || shown}>Kolla ordet</button><button type="button" className="btn-ghost" disabled={feedback === true || shown} onClick={() => { setUsed([]); setTyped(""); setFeedback(null); }}>Börja om</button></div>
    </form>}
    <div className="min-h-16 text-center" aria-live="polite">{feedback === true ? <p className="font-medium text-sage">✓ Där satt den! {pair.term} = {pair.translation}</p> : shown ? <p>Så här blir det: <strong>{expected}</strong>. Läs ordet högt en gång.</p> : feedback === false ? <p className="text-brass">Inte riktigt. Prova igen – du får så många försök du behöver.</p> : <p className="text-sm text-muted">Ta den tid du behöver.</p>}
      {feedback === true || shown ? <button className="btn-primary mt-3" onClick={() => onAnswer(pair, feedback === true && attempts === 1 && !shown, choice || typed)}>Fortsätt →</button> : <button className="btn-ghost mt-2 text-sm" onClick={() => setShown(true)}>Visa svaret & träna igen senare</button>}
    </div>
  </section>;
}
