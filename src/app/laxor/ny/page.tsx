"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { SUBJECTS } from "@/lib/helpers";
import { extractTextFromPdf, readFileAsDataUrl } from "@/lib/pdf";
import type { Homework, Subject } from "@/lib/types";
import { ensureHomeworkReminder, loadData, upsertCalendarEvent, upsertHomework } from "@/lib/store";
import { notifyDataChanged } from "@/components/useAppData";
import { TimeInput24 } from "@/components/TimeInput24";

const MAX_IMAGE_BYTES = 2_500_000;
const MAX_PDF_BYTES = 5_000_000;

export default function NyLaxaPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<Subject>("Matematik");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [helpNeeded, setHelpNeeded] = useState("");
  const [pageHints, setPageHints] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const [pdfDataUrl, setPdfDataUrl] = useState<string | undefined>();
  const [pdfFileName, setPdfFileName] = useState<string | undefined>();
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
        setPdfDataUrl(dataUrl);
        setPdfFileName(file.name);
        setPhotoDataUrl(undefined);
        if (text.trim()) {
          setExtractedText((prev) => prev.trim() || text.trim());
        }
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
      setPhotoDataUrl(dataUrl);
      setPdfDataUrl(undefined);
      setPdfFileName(undefined);
    } catch {
      setError("Kunde inte läsa filen. Försök igen.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      setError("Titel och datum behövs.");
      return;
    }
    const hw: Homework = {
      id: crypto.randomUUID(),
      title: title.trim(),
      subject,
      dueDate,
      createdAt: new Date().toISOString(),
      status: "todo",
      description: description.trim(),
      helpNeeded: helpNeeded.trim(),
      pageHints: pageHints.trim(),
      photoDataUrl,
      pdfDataUrl,
      pdfFileName,
      extractedText:
        extractedText.trim() ||
        description.trim() ||
        `Läxa: ${title}. Ämne: ${subject}.`,
      reminderEnabled,
    };
    upsertHomework(hw);
    if (reminderEnabled) {
      ensureHomeworkReminder(hw, reminderTime || "09:00");
      const cal = loadData().calendarEvents.find(
        (e) => e.homeworkId === hw.id && e.type === "homework",
      );
      if (cal) {
        upsertCalendarEvent({ ...cal, time: reminderTime || "09:00" });
      }
    }
    notifyDataChanged();
    router.push(`/laxor/${hw.id}`);
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <Link href="/laxor" className="text-sm text-muted hover:text-ink">
          ← Tillbaka
        </Link>
        <h1 className="font-display mt-2 text-3xl font-medium tracking-tight">
          Ny läxa
        </h1>
        <p className="mt-1 text-muted">
          Ladda upp foto eller PDF — Buddie hittar på förhörsfrågor utifrån
          materialet.
        </p>
      </div>

      <form onSubmit={submit} className="panel space-y-4 p-5 sm:p-6">
        <div>
          <label className="label">Titel</label>
          <input
            className="input-field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="T.ex. Bråk övning 1–10"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Ämne</label>
            <select
              className="input-field"
              value={subject}
              onChange={(e) => setSubject(e.target.value as Subject)}
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Datum</label>
            <input
              type="date"
              className="input-field"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Vad ska du göra?</label>
          <textarea
            className="input-field min-h-24"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Extra hjälp</label>
          <input
            className="input-field"
            value={helpNeeded}
            onChange={(e) => setHelpNeeded(e.target.value)}
            placeholder="T.ex. gemensam nämnare"
          />
        </div>

        <div>
          <label className="label">Sidhänvisning</label>
          <input
            className="input-field"
            value={pageHints}
            onChange={(e) => setPageHints(e.target.value)}
            placeholder="t.ex. sid 4 i häftet"
          />
        </div>

        <div>
          <label className="label">Foto eller PDF</label>
          <input
            type="file"
            accept="image/*,application/pdf,.pdf"
            capture="environment"
            className="input-field"
            disabled={busy}
            onChange={(e) => void onAttachment(e.target.files?.[0] ?? null)}
          />
          {busy && (
            <p className="mt-2 text-sm text-muted">Läser filen…</p>
          )}
          {photoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoDataUrl}
              alt="Förhandsvisning"
              className="mt-3 max-h-48 rounded-xl object-contain"
            />
          )}
          {pdfDataUrl && (
            <p className="mt-3 rounded-xl bg-sky-soft/50 px-3 py-2 text-sm text-ink-soft">
              PDF vald: <strong>{pdfFileName || "dokument.pdf"}</strong>
            </p>
          )}
        </div>

        <div>
          <label className="label">Text från läxan</label>
          <textarea
            className="input-field min-h-28"
            value={extractedText}
            onChange={(e) => setExtractedText(e.target.value)}
            placeholder="Fylls i automatiskt från PDF om möjligt…"
          />
        </div>

        <div className="space-y-2 rounded-xl bg-white/60 px-3 py-3">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
            />
            Lägg till påminnelse (1 h innan)
          </label>
          {reminderEnabled && (
            <div>
              <label className="label">Tid för deadline</label>
              <TimeInput24
                value={reminderTime}
                onChange={setReminderTime}
                className="w-full"
              />
              <p className="mt-1 text-xs text-muted">
                Påminnelsen skickas en timme innan den här tiden.
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button type="submit" className="btn-primary" disabled={busy}>
          Spara läxa
        </button>
      </form>
    </div>
  );
}
