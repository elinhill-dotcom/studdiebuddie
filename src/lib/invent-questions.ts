/**
 * Förbättrad lokal frågegenerator – “hittar på” frågor från materialet
 * när OpenAI-nyckel saknas.
 */
import type { Homework, QuizQuestion } from "./types";

function id() {
  return crypto.randomUUID();
}

function tipFromHomework(hw: Homework): string {
  if (hw.pageHints?.trim()) return `Läs mer om detta på ${hw.pageHints}.`;
  if (hw.helpNeeded?.trim())
    return `Kolla dina anteckningar om: ${hw.helpNeeded}.`;
  return "Gå tillbaka till läxan/fotot och läs den viktiga delen en gång till.";
}

function chunks(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((s) => s.replace(/^\s*[-•*\d.)]+\s*/, "").trim())
    .filter((s) => s.length > 12);

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const all = [...lines, ...sentences];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of all) {
    const key = c.toLowerCase().slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  return unique;
}

function inventPrompt(fact: string, hw: Homework, i: number): string {
  const short =
    fact.length > 90 ? `${fact.slice(0, 87).trim()}…` : fact;
  const variants = [
    `Utifrån din läxa: förklara med egna ord vad det här betyder — “${short}”`,
    `Varför är detta viktigt i ${hw.subject}? “${short}”`,
    `Ge ett eget exempel som hör ihop med: “${short}”`,
    `Om du skulle lära en kompis detta, hur skulle du börja? Material: “${short}”`,
    `Vilka nyckelord från läxan hör ihop med: “${short}”? Förklara kort.`,
    `Sammanfatta den här delen i en mening, utan att bara kopiera: “${short}”`,
  ];
  return variants[i % variants.length];
}

export function inventQuestionsFromHomework(
  hw: Homework,
  count = 6,
): QuizQuestion[] {
  const tip = tipFromHomework(hw);
  const source = `${hw.extractedText}\n${hw.description}`.trim();
  const parts = chunks(source);
  const questions: QuizQuestion[] = [];

  if (hw.helpNeeded?.trim()) {
    questions.push({
      id: id(),
      prompt: `Du skrev att du behöver extra hjälp med “${hw.helpNeeded}”. Förklara det så enkelt du kan, med egna ord.`,
      expectedAnswer: hw.helpNeeded,
      tip,
      topic: hw.helpNeeded.slice(0, 40),
    });
  }

  parts.forEach((fact, i) => {
    if (questions.length >= count) return;
    questions.push({
      id: id(),
      prompt: inventPrompt(fact, hw, i),
      expectedAnswer: fact,
      tip,
      topic: fact.split(/\s+/).slice(0, 3).join(" "),
    });
  });

  while (questions.length < Math.min(count, 3)) {
    questions.push({
      id: id(),
      prompt: `Vad är det viktigaste du ska kunna från läxan “${hw.title}”? Berätta tre saker.`,
      expectedAnswer: source.slice(0, 200) || hw.title,
      tip,
      topic: "översikt",
    });
    questions.push({
      id: id(),
      prompt: `Finns det något i läxan som fortfarande känns svårt? Förklara vad du redan förstår om ${hw.subject}.`,
      expectedAnswer: hw.helpNeeded || hw.description || hw.title,
      tip,
      topic: hw.subject,
    });
  }

  // blanda
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  return questions.slice(0, count);
}
