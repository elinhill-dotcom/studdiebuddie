import type { Homework, VocabPair } from "./types";
import { combinedAttachmentText, normalizeAttachments } from "./attachments";

export async function extractHomeworkVocab(hw: Homework, languageFrom: string, languageTo: string): Promise<VocabPair[]> {
  const files = normalizeAttachments(hw);
  const text = combinedAttachmentText(hw) || (files.length ? "" : hw.description);
  const inputs: { extractedText?: string; photoDataUrl?: string; pdfDataUrl?: string; pdfFileName?: string }[] = [];
  if (text.trim()) inputs.push({ extractedText: text });
  for (const file of files) {
    if (file.extractedText?.trim()) continue;
    if (file.kind === "image") inputs.push({ photoDataUrl: file.dataUrl });
    else inputs.push({ pdfDataUrl: file.dataUrl, pdfFileName: file.fileName });
  }
  if (!inputs.length) throw new Error("Lägg till foto, bild, PDF eller glostext först.");
  const result: VocabPair[] = [];
  for (const input of inputs) {
    const res = await fetch("/api/vocab/extract", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(60000), body: JSON.stringify({ ...input, languageFrom, languageTo }) });
    const json = await res.json();
    if (!res.ok || !json.pairs?.length) throw new Error(json.error || "Kunde inte läsa glosorna. Materialet finns kvar – prova igen eller skriv in orden.");
    result.push(...json.pairs.map((p: { term: string; translation: string }) => ({ ...p, id: crypto.randomUUID() })));
  }
  const seen = new Set<string>();
  return result.filter(p => { const key = `${p.term.trim().toLocaleLowerCase()}|${p.translation.trim().toLocaleLowerCase()}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
