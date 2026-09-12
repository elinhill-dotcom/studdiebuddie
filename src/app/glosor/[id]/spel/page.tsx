"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAppData } from "@/components/useAppData";
import { VocabGames } from "@/components/VocabGames";
import { VOCAB_GAMES } from "@/lib/vocab-games";

function GamePage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { data, ready } = useAppData();
  const list = data.vocabLists.find(v => v.id === id);
  const game = VOCAB_GAMES.find(g => g.id === params.get("game"))?.id || "memory";
  const selected = params.get("words")?.split(",");
  if (!ready) return <p>Laddar spel…</p>;
  if (!list) return <p>Gloslistan hittades inte. <Link href="/glosor">Till glosor</Link></p>;
  return <VocabGames key={`${id}-${game}`} game={game} list={{ ...list, pairs: selected ? list.pairs.filter(p => selected.includes(p.id)) : list.pairs }} />;
}
export default function Page() { return <Suspense fallback={<p>Laddar spel…</p>}><GamePage /></Suspense>; }
