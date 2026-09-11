"use client";

import { useRef, useState } from "react";
import {
  MAX_ATTACHMENTS,
  normalizeAttachments,
} from "@/lib/attachments";
import {
  compressImageToDataUrl,
  extractTextFromPdf,
  readFileAsDataUrl,
} from "@/lib/pdf";
import type { Homework, HomeworkAttachment } from "@/lib/types";

const MAX_PDF_BYTES = 40_000_000;
const MAX_RAW_IMAGE_BYTES = 25_000_000;
/** Undvik att lagra jätte-PDF:er som base64 i localStorage — texten räcker till förhör */
const MAX_STORED_PDF_DATA_URL = 6_000_000;

export type HomeworkAttachmentValue = {
  attachments: HomeworkAttachment[];
  extractedText: string;
};

/** Bygg värde från en läxa (inkl. legacy-fält) */
export function attachmentValueFromHomework(hw: Homework): HomeworkAttachmentValue {
  return {
    attachments: normalizeAttachments(hw),
    extractedText: hw.extractedText || "",
  };
}

function joinExtracted(attachments: HomeworkAttachment[], manual: string) {
  const fromFiles = attachments
    .map((a) => a.extractedText?.trim())
    .filter(Boolean)
    .join("\n\n");
  if (manual.trim() && fromFiles && !fromFiles.includes(manual.trim().slice(0, 40))) {
    return [manual.trim(), fromFiles].join("\n\n");
  }
  return manual.trim() || fromFiles;
}

/** Ladda upp flera foto/PDF till en läxa */
export function HomeworkAttachments({
  value,
  onChange,
  optionalHint = true,
}: {
  value: HomeworkAttachmentValue;
  onChange: (next: HomeworkAttachmentValue) => void;
  optionalHint?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const emit = (attachments: HomeworkAttachment[], extractedText?: string) => {
    const text =
      extractedText !== undefined
        ? extractedText
        : joinExtracted(attachments, value.extractedText);
    onChange({ attachments, extractedText: text });
  };

  const addFiles = async (files: FileList | File[] | null, prefer: "image" | "pdf" | "any") => {
    if (!files?.length) return;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      let next = [...value.attachments];
      const notes: string[] = [];

      for (const file of Array.from(files)) {
        if (next.length >= MAX_ATTACHMENTS) {
          setError(`Max ${MAX_ATTACHMENTS} filer per läxa.`);
          break;
        }

        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        const isImage = file.type.startsWith("image/");

        if (prefer === "pdf" || (prefer === "any" && isPdf)) {
          if (!isPdf) {
            setError("Välj en PDF-fil.");
            continue;
          }
          if (file.size > MAX_PDF_BYTES) {
            setError(`“${file.name}” är för stor (max ca 40 MB).`);
            continue;
          }
          const [text, dataUrl] = await Promise.all([
            extractTextFromPdf(file).catch(() => ""),
            readFileAsDataUrl(file),
          ]);
          if (!text.trim() && !dataUrl) {
            setError(`Kunde inte läsa “${file.name}”.`);
            continue;
          }
          if (text.trim()) {
            notes.push(
              `“${file.name}”: text utläst (${text.trim().length} tecken).`,
            );
          } else {
            notes.push(
              `“${file.name}”: ingen text hittades (skannad PDF?) — filen sparas ändå.`,
            );
          }
          if (dataUrl.length > MAX_STORED_PDF_DATA_URL) {
            notes.push(
              "Stor PDF — förhöret använder framför allt den utlästa texten.",
            );
          }
          next.push({
            id: crypto.randomUUID(),
            kind: "pdf",
            dataUrl,
            fileName: file.name,
            extractedText: text.trim() || undefined,
          });
          continue;
        }

        if (prefer === "image" || (prefer === "any" && isImage)) {
          if (!isImage) {
            setError("Välj en bild.");
            continue;
          }
          if (file.size > MAX_RAW_IMAGE_BYTES) {
            setError(`“${file.name}” är ovanligt stor.`);
            continue;
          }
          const dataUrl = await compressImageToDataUrl(file);
          next.push({
            id: crypto.randomUUID(),
            kind: "image",
            dataUrl,
            fileName: file.name || "foto.jpg",
          });
          continue;
        }

        setError("Välj bild eller PDF.");
      }

      // Rensa ogiltiga poster
      next = next.filter(
        (a) =>
          (a.kind === "image" && a.dataUrl.startsWith("data:image")) ||
          (a.kind === "pdf" &&
            (a.dataUrl.startsWith("data:application/pdf") ||
              a.dataUrl.startsWith("http") ||
              Boolean(a.extractedText?.trim()))),
      );
      emit(next);
      if (notes.length) setInfo(notes.slice(-3).join(" "));
    } catch {
      setError("Kunde inte läsa filen. Försök igen.");
    } finally {
      setBusy(false);
    }
  };

  const removeAt = (id: string) => {
    const next = value.attachments.filter((a) => a.id !== id);
    emit(next);
  };

  const clearFiles = () => {
    emit([]);
    setInfo("");
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Filer (fler tillåtna)</label>
        {optionalHint && (
          <p className="mb-1.5 text-xs text-muted">
            Lägg till flera bilder eller PDF:er — även långa häften. Text läses
            ut automatiskt.
          </p>
        )}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="fixed left-[-9999px] top-0 h-px w-px opacity-0"
          tabIndex={-1}
          disabled={busy}
          onChange={(e) => {
            void addFiles(e.target.files, "image");
            e.target.value = "";
          }}
        />
        <input
          ref={libraryRef}
          type="file"
          accept="image/*"
          multiple
          className="fixed left-[-9999px] top-0 h-px w-px opacity-0"
          tabIndex={-1}
          disabled={busy}
          onChange={(e) => {
            void addFiles(e.target.files, "image");
            e.target.value = "";
          }}
        />
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="fixed left-[-9999px] top-0 h-px w-px opacity-0"
          tabIndex={-1}
          disabled={busy}
          onChange={(e) => {
            void addFiles(e.target.files, "pdf");
            e.target.value = "";
          }}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            className="btn-secondary py-2 text-sm"
            disabled={busy || value.attachments.length >= MAX_ATTACHMENTS}
            onClick={() => cameraRef.current?.click()}
          >
            Ta foto
          </button>
          <button
            type="button"
            className="btn-secondary py-2 text-sm"
            disabled={busy || value.attachments.length >= MAX_ATTACHMENTS}
            onClick={() => libraryRef.current?.click()}
          >
            Bildbibliotek
          </button>
          <button
            type="button"
            className="btn-secondary py-2 text-sm"
            disabled={busy || value.attachments.length >= MAX_ATTACHMENTS}
            onClick={() => pdfRef.current?.click()}
          >
            Välj PDF
          </button>
        </div>

        {busy && (
          <p className="mt-2 text-sm text-muted">
            Läser filen (stora PDF:er kan ta en stund)…
          </p>
        )}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        {info && <p className="mt-2 text-xs text-ink-soft">{info}</p>}
      </div>

      {value.attachments.length > 0 && (
        <ul className="space-y-2">
          {value.attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-3 rounded-xl bg-white/70 px-3 py-2"
            >
              {a.kind === "image" && a.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.dataUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-sky-soft text-xs font-semibold text-sky">
                  PDF
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {a.fileName || (a.kind === "pdf" ? "dokument.pdf" : "foto")}
                </p>
                <p className="text-xs text-muted">
                  {a.kind === "pdf"
                    ? a.extractedText?.trim()
                      ? `Text utläst · ${a.extractedText.trim().length} tecken`
                      : a.dataUrl
                        ? "PDF sparad"
                        : "Endast text"
                    : "Bild"}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost shrink-0 px-2 text-sm text-danger"
                onClick={() => removeAt(a.id)}
              >
                Ta bort
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label className="label">Text från läxan</label>
        <textarea
          className="input-field min-h-24"
          value={value.extractedText}
          onChange={(e) =>
            onChange({ ...value, extractedText: e.target.value })
          }
          placeholder="Fylls i automatiskt från PDF:er…"
        />
      </div>

      {value.attachments.length > 0 && (
        <button type="button" className="btn-ghost text-sm" onClick={clearFiles}>
          Ta bort alla filer
        </button>
      )}
    </div>
  );
}
