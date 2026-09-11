import type { Homework, QuizQuestion, VocabList } from "./types";

/**
 * AI-förhör: genererar FRÅGOR utifrån läxmaterial.
 * Ger aldrig färdiga svar till eleven under förhöret.
 * expectedAnswer används bara internt för rättning.
 */

function id() {
  return crypto.randomUUID();
}

function splitFacts(text: string): string[] {
  return text
    .split(/[\n.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 18);
}

function tipFromHomework(hw: Homework): string | undefined {
  if (hw.pageHints?.trim()) {
    return `Läs mer om detta på ${hw.pageHints}.`;
  }
  if (hw.helpNeeded?.trim()) {
    return `Kolla dina anteckningar om: ${hw.helpNeeded}.`;
  }
  return "Gå tillbaka till läxan och läs igenom den viktiga delen en gång till.";
}

/** Enkel lokal frågegenerator (MVP). Byt ut mot riktig AI-API senare. */
export function generateQuestionsFromHomework(
  hw: Homework,
  count = 5,
): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const facts = splitFacts(hw.extractedText || hw.description);

  if (hw.helpNeeded?.trim()) {
    questions.push({
      id: id(),
      prompt: `Du skrev att du behöver hjälp med: "${hw.helpNeeded}". Kan du förklara det med egna ord?`,
      expectedAnswer: hw.helpNeeded,
      tip: tipFromHomework(hw),
      topic: hw.helpNeeded.slice(0, 40),
    });
  }

  for (const fact of facts) {
    if (questions.length >= count) break;
    const words = fact.split(/\s+/);
    if (words.length < 4) continue;

    const isNumberHeavy = /\d/.test(fact);
    if (isNumberHeavy) {
      questions.push({
        id: id(),
        prompt: `Utifrån din läxa (${hw.subject}): hur löser du detta – "${fact.slice(0, 80)}${fact.length > 80 ? "…" : ""}"? Berätta stegen.`,
        expectedAnswer: fact,
        tip: tipFromHomework(hw),
        topic: hw.title,
      });
    } else {
      const key = words.slice(0, 3).join(" ");
      questions.push({
        id: id(),
        prompt: `Vad minns du om detta från läxan "${hw.title}"? Börja från: "${key}…"`,
        expectedAnswer: fact,
        tip: tipFromHomework(hw),
        topic: key,
      });
    }
  }

  if (questions.length < 2) {
    questions.push({
      id: id(),
      prompt: `Sammanfatta läxan "${hw.title}" i tre korta punkter. Vad är viktigast?`,
      expectedAnswer: hw.description || hw.title,
      tip: tipFromHomework(hw),
      topic: "översikt",
    });
    questions.push({
      id: id(),
      prompt: `Om en kompis frågar dig om ${hw.subject}-läxan – vad skulle du säga först?`,
      expectedAnswer: hw.extractedText.slice(0, 120) || hw.description,
      tip: tipFromHomework(hw),
      topic: hw.subject,
    });
  }

  return questions.slice(0, count);
}

export function generateSummaryQuestions(
  homeworks: Homework[],
  count = 8,
): QuizQuestion[] {
  const picked = homeworks.slice(0, 12);
  const all: QuizQuestion[] = [];
  for (const hw of picked) {
    all.push(...generateQuestionsFromHomework(hw, 2));
  }
  // blanda
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, count);
}

/** Skriv om en fråga eleven missade – fortfarande ingen facit. */
export function rewriteQuestion(q: QuizQuestion, hw?: Homework): QuizQuestion {
  return {
    id: id(),
    rewrittenFromId: q.id,
    prompt: `Vi tar om det på ett annat sätt: ${softenPrompt(q.prompt)}`,
    expectedAnswer: q.expectedAnswer,
    tip: q.tip || (hw ? tipFromHomework(hw) : undefined),
    topic: q.topic,
  };
}

function softenPrompt(prompt: string): string {
  return prompt
    .replace(/^Vad minns du/, "Kan du berätta mer")
    .replace(/^Sammanfatta/, "Försök sammanfatta igen")
    .replace(/\?$/, " – ta det lugnt, steg för steg?");
}

/**
 * Rättning för förhör — egna ord räcker, bokstavlig kopiering krävs inte.
 * Delar upp expected i delar (listor/och/komma) och räknar träffar.
 */
export function gradeAnswer(
  userAnswer: string,
  expected: string,
): { correct: boolean; partial: boolean; feedback: string; hitRatio: number } {
  const a = normalize(userAnswer);
  const e = normalize(expected);
  if (a.length < 2) {
    return {
      correct: false,
      partial: false,
      hitRatio: 0,
      feedback: "Skriv gärna lite mer så vi kan se hur du tänker.",
    };
  }

  const parts = splitExpectedParts(expected);
  if (parts.length >= 2) {
    const hitParts = parts.filter((p) => partCovered(a, p));
    const hitRatio = hitParts.length / parts.length;
    if (hitRatio >= 0.67) {
      return {
        correct: true,
        partial: false,
        hitRatio,
        feedback: "Bra — du har med det viktiga, med egna ord.",
      };
    }
    if (hitParts.length > 0) {
      return {
        correct: false,
        partial: true,
        hitRatio,
        feedback: `Bra, du har ${hitParts.length} av ${parts.length} delar. Vad mer hör till?`,
      };
    }
  }

  const eWords = significantWords(e);
  const hits = eWords.filter((w) => a.includes(w)).length;
  const ratio = eWords.length ? hits / eWords.length : 0;

  // Egna ord / omskrivning: lägre tröskel än bokstavlig match
  if (ratio >= 0.28 || fuzzyContains(a, e) || fuzzyContains(e, a)) {
    return {
      correct: true,
      partial: false,
      hitRatio: Math.max(ratio, 0.5),
      feedback: "Nice! Du är inne på rätt spår — egna ord funkar fint.",
    };
  }

  if (ratio >= 0.15) {
    return {
      correct: false,
      partial: true,
      hitRatio: ratio,
      feedback:
        "Du är inne på något rätt. Lägg till det som fortfarande saknas — med egna ord.",
    };
  }

  return {
    correct: false,
    partial: false,
    hitRatio: ratio,
    feedback:
      "Inte riktigt ännu – men bra försök. Titta på tipset och prova igen med egna ord.",
  };
}

function splitExpectedParts(expected: string): string[] {
  const raw = expected
    .split(/\n+|;\s*|\d+[.)]\s+|[-•*]\s+|,\s+(?=[A-ZÅÄÖ])|\s+och\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  if (raw.length >= 2) return raw;
  // fallback: meningar
  const sentences = expected
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  return sentences.length >= 2 ? sentences : [];
}

function partCovered(answerNorm: string, part: string): boolean {
  const p = normalize(part);
  const words = significantWords(p);
  if (!words.length) return answerNorm.includes(p.slice(0, 12));
  const hits = words.filter((w) => answerNorm.includes(w)).length;
  return hits / words.length >= 0.4 || answerNorm.includes(p.slice(0, 16));
}

function significantWords(s: string): string[] {
  const stop = new Set([
    "och",
    "eller",
    "att",
    "det",
    "den",
    "som",
    "for",
    "för",
    "med",
    "till",
    "fran",
    "från",
    "en",
    "ett",
    "ar",
    "är",
    "pa",
    "på",
    "av",
    "om",
    "man",
    "kan",
    "ska",
    "the",
    "and",
    "or",
    "to",
    "of",
    "a",
    "an",
    "is",
    "in",
    "on",
  ]);
  return s
    .split(" ")
    .filter((w) => w.length > 2 && !stop.has(w));
}

function fuzzyContains(hay: string, needle: string): boolean {
  if (needle.length < 8) return hay.includes(needle);
  const chunk = needle.slice(0, Math.min(24, needle.length));
  return hay.includes(chunk);
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Striktare rättning för glosor — utan att visa facit. */
export function gradeVocabAnswer(
  userAnswer: string,
  expected: string,
): { correct: boolean; feedback: string } {
  const a = normalize(userAnswer);
  const e = normalize(expected);
  if (!a) {
    return { correct: false, feedback: "Skriv ett ord eller en fras." };
  }
  if (a === e) {
    return { correct: true, feedback: "Rätt!" };
  }
  // tillåt flera acceptabla svar separerade med /
  const alts = e.split(/\s+\/\s+|\s*,\s*/).map((x) => x.trim()).filter(Boolean);
  if (alts.some((alt) => alt === a)) {
    return { correct: true, feedback: "Rätt!" };
  }
  // liten stavfelstolerans
  if (e.length >= 4 && levenshtein(a, e) <= 1) {
    return { correct: true, feedback: "Rätt (nästan perfekt stavat)!" };
  }
  return {
    correct: false,
    feedback: "Inte riktigt — kolla gloslistan och prova igen.",
  };
}

function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

/** Glosförhör: blandar riktning term→översättning och tvärtom. */
export function generateVocabQuestions(
  list: VocabList,
  count?: number,
): QuizQuestion[] {
  const pairs = [...list.pairs].filter(
    (p) => p.term.trim() && p.translation.trim(),
  );
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  const take = pairs.slice(0, count ?? pairs.length);
  return take.map((p, idx) => {
    const askTerm = idx % 2 === 0;
    if (askTerm) {
      return {
        id: id(),
        prompt: `Vad betyder “${p.term}” på ${list.languageTo}?`,
        expectedAnswer: p.translation,
        tip: `Titta upp ordet i gloslistan “${list.title}”.`,
        topic: p.term,
      };
    }
    return {
      id: id(),
      prompt: `Hur säger man “${p.translation}” på ${list.languageFrom}?`,
      expectedAnswer: p.term,
      tip: `Titta upp översättningen i gloslistan “${list.title}”.`,
      topic: p.translation,
    };
  });
}

/** Klistra in rader: ord - översättning | ord; översättning | ord[TAB]översättning */
export function parseVocabPaste(raw: string): { term: string; translation: string }[] {
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+[-–—:]\s+|\t+|;\s*/);
      if (parts.length >= 2) {
        return {
          term: parts[0].trim(),
          translation: parts.slice(1).join(" ").trim(),
        };
      }
      return null;
    })
    .filter((x): x is { term: string; translation: string } =>
      Boolean(x?.term && x?.translation),
    );
}
