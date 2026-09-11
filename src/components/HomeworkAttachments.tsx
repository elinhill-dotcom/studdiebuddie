"use client";

import { useRef, useState } from "react";
import {
  compressImageToDataUrl,
  extractTextFromPdf,
  readFileAsDataUrl,
} from "@/lib/pdf";
import type { Homework } from "@/lib/types";

const MAX_PDF_BYTES = 12_000_000;
/** Råfil innan komprimering — telefonkameror är ofta stora */
const MAX_RAW_IMAGE_BYTES = 25_000_000;

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
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const onImage = async (file: File | null) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      if (!file.type.startsWith("image/")) {
        setError("Välj en bild.");
        return;
      }
      if (file.size > MAX_RAW_IMAGE_BYTES) {
        setError("Bilden är ovanligt stor. Prova en annan bild.");
        return;
      }
      const dataUrl = await compressImageToDataUrl(file);
      onChange({
        ...value,
        photoDataUrl: dataUrl,
        pdfDataUrl: undefined,
        pdfFileName: undefined,
      });
    } catch {
      setError("Kunde inte läsa bilden. Försök igen.");
    } finally {
      setBusy(false);
    }
  };

  const onPdf = async (file: File | null) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      if (
        !(
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf")
        )
      ) {
        setError("Välj en PDF-fil.");
        return;
      }
      if (file.size > MAX_PDF_BYTES) {
        setError("PDF:en är för stor (max ca 12 MB).");
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
    } catch {
      setError("Kunde inte läsa PDF:en. Försök igen.");
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

        {/* Dolda inputs — kamera, galleri och PDF var för sig */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="fixed left-[-9999px] top-0 h-px w-px opacity-0"
          tabIndex={-1}
          disabled={busy}
          onChange={(e) => {
            void onImage(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <input
          ref={libraryRef}
          type="file"
          accept="image/*"
          className="fixed left-[-9999px] top-0 h-px w-px opacity-0"
          tabIndex={-1}
          disabled={busy}
          onChange={(e) => {
            void onImage(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf,.pdf"
          className="fixed left-[-9999px] top-0 h-px w-px opacity-0"
          tabIndex={-1}
          disabled={busy}
          onChange={(e) => {
            void onPdf(e.target.files?.[0] ?? null);
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

        {busy && <p className="mt-2 text-sm text-muted">Bearbetar filen…</p>}
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
