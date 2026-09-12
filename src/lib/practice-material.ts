export type PracticeFormat = "chat" | "exam" | "flashcards";

/** Keep every part of long homework, splitting near paragraph/word boundaries. */
export function practiceBatches(text: string, format: PracticeFormat) {
  const density = format === "flashcards" ? 500 : format === "exam" ? 1000 : 800;
  const batches: { text: string; count: number }[] = [];
  let remaining = text.trim();
  while (remaining) {
    let end = Math.min(6000, remaining.length);
    if (end < remaining.length) {
      const paragraph = remaining.lastIndexOf("\n", end);
      const space = remaining.lastIndexOf(" ", end);
      if (paragraph >= 4000) end = paragraph;
      else if (space >= 4000) end = space;
    }
    const section = remaining.slice(0, end).trim();
    batches.push({ text: section, count: Math.max(3, Math.ceil(section.length / density)) });
    remaining = remaining.slice(end).trim();
  }
  return batches;
}
