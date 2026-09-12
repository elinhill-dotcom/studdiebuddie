import type { VocabPair } from "./types";

export const VOCAB_GAMES = [
  { id: "memory", name: "Memory", icon: "▦", tint: "sage", description: "Vänd korten. Hitta ordet och dess översättning." },
  { id: "choice", name: "Ordjakten", icon: "◎", tint: "lilac", description: "Ett ord, flera möjligheter. Vilken översättning stämmer?" },
  { id: "scramble", name: "Bokstavsmix", icon: "Aa", tint: "sky", description: "Blandade bokstäver. Bygg rätt ord, en bokstav i taget." },
] as const;
export type VocabGame = typeof VOCAB_GAMES[number]["id"];
export const wordKey = (value: string) => value.normalize("NFC").toLocaleLowerCase().trim().replace(/\s+/g, " ");

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function gamePairs(pairs: VocabPair[], game: VocabGame) {
  const seen = new Set<string>();
  const terms = new Set<string>();
  const translations = new Set<string>();
  return pairs.filter(p => {
    const term = wordKey(p.term), translation = wordKey(p.translation);
    if (!term || !translation || seen.has(`${term}|${translation}`)) return false;
    if ((game === "memory" && (terms.has(term) || translations.has(translation))) ||
        (game === "choice" && terms.has(term)) ||
        (game === "scramble" && translations.has(translation))) return false;
    seen.add(`${term}|${translation}`); terms.add(term); translations.add(translation);
    return true;
  });
}

export function answerOptions(pair: VocabPair, pairs: VocabPair[]) {
  const unique = new Map(pairs.filter(p => wordKey(p.translation) !== wordKey(pair.translation)).map(p => [wordKey(p.translation), p.translation]));
  return shuffle([pair.translation, ...shuffle([...unique.values()]).slice(0, 3)]);
}

export function mixedLetters(word: string) {
  const letters = Array.from(word.normalize("NFC"));
  const result = shuffle(letters);
  if (result.join("") === word && new Set(letters).size > 1) {
    const different = result.findIndex(letter => letter !== result[0]);
    [result[0], result[different]] = [result[different], result[0]];
  }
  return result;
}
