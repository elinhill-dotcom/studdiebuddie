import type { Homework, HomeworkAttachment } from "./types";

const MAX_ATTACHMENTS = 12;

/** Normalisera till attachments[] (inkl. äldre single photo/pdf-fält) */
export function normalizeAttachments(hw: Homework): HomeworkAttachment[] {
  if (hw.attachments?.length) return hw.attachments;
  const out: HomeworkAttachment[] = [];
  if (hw.photoDataUrl) {
    out.push({
      id: "legacy-photo",
      kind: "image",
      dataUrl: hw.photoDataUrl,
      fileName: "foto.jpg",
    });
  }
  if (hw.pdfDataUrl) {
    out.push({
      id: "legacy-pdf",
      kind: "pdf",
      dataUrl: hw.pdfDataUrl,
      fileName: hw.pdfFileName || "laxa.pdf",
    });
  }
  return out;
}

/** Spegla första bild/PDF + samlad text till legacy-fält */
export function withMirroredAttachmentFields(
  hw: Omit<Homework, "photoDataUrl" | "pdfDataUrl" | "pdfFileName" | "extractedText" | "attachments"> & {
    attachments: HomeworkAttachment[];
    extractedText?: string;
  },
): Homework {
  const attachments = hw.attachments.slice(0, MAX_ATTACHMENTS);
  const firstImage = attachments.find((a) => a.kind === "image");
  const firstPdf = attachments.find((a) => a.kind === "pdf");
  const fromFiles = attachments
    .map((a) => a.extractedText?.trim())
    .filter(Boolean)
    .join("\n\n");
  const extractedText =
    hw.extractedText?.trim() ||
    fromFiles ||
    hw.description.trim() ||
    `Läxa: ${hw.title}. Ämne: ${hw.subject}.`;

  return {
    ...hw,
    attachments,
    photoDataUrl: firstImage?.dataUrl,
    pdfDataUrl: firstPdf?.dataUrl,
    pdfFileName: firstPdf?.fileName,
    extractedText,
  };
}

export function hasHomeworkFiles(hw: Homework) {
  return normalizeAttachments(hw).length > 0;
}

export function hasQuizMaterial(hw: Homework) {
  return Boolean(
    hw.extractedText?.trim() ||
      hw.description?.trim() ||
      hasHomeworkFiles(hw),
  );
}

export function combinedAttachmentText(hw: Homework) {
  const parts = normalizeAttachments(hw)
    .map((a) => {
      const label = a.fileName || (a.kind === "pdf" ? "PDF" : "Bild");
      const text = a.extractedText?.trim();
      return text ? `--- ${label} ---\n${text}` : "";
    })
    .filter(Boolean);
  if (hw.extractedText?.trim()) {
    return [hw.extractedText.trim(), ...parts.filter((p) => !hw.extractedText!.includes(p.slice(0, 40)))].join(
      "\n\n",
    );
  }
  return parts.join("\n\n");
}

export { MAX_ATTACHMENTS };
