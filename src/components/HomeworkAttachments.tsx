"use client";

import { useState } from "react";
import { extractTextFromPdf, readFileAsDataUrl } from "@/lib/pdf";
import type { Homework } from "@/lib/types";

const MAX_IMAGE_BYTES = 2_500_000;
const MAX_PDF_BYTES = 5_000_000;

export type HomeworkAttachmentPatch = Pick<
  Homework,
  "photoDataUrl" | "pdfDataUrl" | "pdfFileName" | "extractedText"
>;

/** Ladda upp foto/PDF till en läxa — kan användas vid skapande, senare eller inför förhör */
export function HomeworkAttachments({
  value,
  onChange,
  optionalHint = true,
}: {
  value: HomeworkAttachmentPatch;
  onChange: (next: HomeworkAttachmentPatch) => void;
  optionalHint?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onAttachment = async (file: File | null) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        if (file.size > MAX_PDF_BYTES) {
          setError("PDF:en är för stor (max ca 5 MB).");
          return;
        }
        const [dataUrl, text] = await Promise.all([
          readFileAsDataUrl(file),
          extractTextFromPdf(file).catch(() => ""),
        ]);
        onChange({
          photoDataUrl: undefined,
          pdfDataUrl: dataUrl,
          pdfFileName: file.name,
          extractedText: text.trim() || value.extractedText || "",
        });
        return;
      }

      if (!file.type.startsWith("image/")) {
        setError("Välj en bild eller PDF.");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError("Bilden är för stor (max ca 2,5 MB).");
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      onChange({
        ...value,
        photoDataUrl: dataUrl,
        pdfDataUrl: undefined,
        pdfFileName: undefined,
      });
    } catch {
      setError("Kunde inte läsa filen. Försök igen.");
    } finally {
      setBusy(false);
    }
  };

  const clearFiles = () => {
    onChange({
      photoDataUrl: undefined,
      pdfDataUrl: undefined,
      pdfFileName: undefined,
      extractedText: value.extractedText,
    });
  };

  const hasFile = Boolean(value.photoDataUrl || value.pdfDataUrl);

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Foto eller PDF</label>
        {optionalHint && (
          <p className="mb-1.5 text-xs text-muted">
            Valfritt nu — du kan ladda upp senare eller precis innan förhör.
          </p>
        )}
        <input
          type="file"
          accept="image/*,application/pdf,.pdf"
          capture="environment"
          className="input-field"
          disabled={busy}
          onChange={(e) => void onAttachment(e.target.files?.[0] ?? null)}
        />
        {busy && <p className="mt-2 text-sm text-muted">Läser filen…</p>}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      {value.photoDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value.photoDataUrl}
          alt="Förhandsvisning"
          className="max-h-48 rounded-xl object-contain"
        />
      )}
      {value.pdfDataUrl && (
        <p className="rounded-xl bg-sky-soft/50 px-3 py-2 text-sm text-ink-soft">
          PDF: <strong>{value.pdfFileName || "dokument.pdf"}</strong>
        </p>
      )}

      <div>
        <label className="label">Text från läxan</label>
        <textarea
          className="input-field min-h-24"
          value={value.extractedText}
          onChange={(e) =>
            onChange({ ...value, extractedText: e.target.value })
          }
          placeholder="Fylls i automatiskt från PDF om möjligt…"
        />
      </div>

      {hasFile && (
        <button type="button" className="btn-ghost text-sm" onClick={clearFiles}>
          Ta bort fil
        </button>
      )}
    </div>
  );
}
