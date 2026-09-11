"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { SUBJECTS } from "@/lib/helpers";
import type { Homework, Subject } from "@/lib/types";
import { upsertHomework } from "@/lib/store";
import { notifyDataChanged } from "@/components/useAppData";

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
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [error, setError] = useState("");

  const onPhoto = (file: File | null) => {
    if (!file) return;
    if (file.size > 2_500_000) {
      setError("Bilden är för stor (max ca 2,5 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(String(reader.result));
      setError("");
    };
    reader.readAsDataURL(file);
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
      extractedText:
        extractedText.trim() ||
        description.trim() ||
        `Läxa: ${title}. Ämne: ${subject}.`,
      reminderEnabled,
    };
    upsertHomework(hw);
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
          Fota häftet och skriv in text — Buddie hittar på förhörsfrågor utifrån materialet.
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
          <label className="label">Foto av läxan</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="input-field"
            onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
          />
          {photoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoDataUrl}
              alt="Förhandsvisning"
              className="mt-3 max-h-48 rounded-xl object-contain"
            />
          )}
        </div>

        <div>
          <label className="label">Text från läxan</label>
          <textarea
            className="input-field min-h-28"
            value={extractedText}
            onChange={(e) => setExtractedText(e.target.value)}
            placeholder="Skriv in viktiga punkter…"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={reminderEnabled}
            onChange={(e) => setReminderEnabled(e.target.checked)}
          />
          Visa i kommande deadlines
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button type="submit" className="btn-primary">
          Spara läxa
        </button>
      </form>
    </div>
  );
}
