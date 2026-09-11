"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { SUBJECTS } from "@/lib/helpers";
import type { Homework, Subject } from "@/lib/types";
import {
  ensureHomeworkReminder,
  loadData,
  upsertCalendarEvent,
  upsertHomework,
} from "@/lib/store";
import { notifyDataChanged } from "@/components/useAppData";
import { TimeInput24 } from "@/components/TimeInput24";
import { HomeworkAttachments } from "@/components/HomeworkAttachments";

export default function NyLaxaPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<Subject>("Matematik");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [helpNeeded, setHelpNeeded] = useState("");
  const [pageHints, setPageHints] = useState("");
  const [attachments, setAttachments] = useState({
    photoDataUrl: undefined as string | undefined,
    pdfDataUrl: undefined as string | undefined,
    pdfFileName: undefined as string | undefined,
    extractedText: "",
  });
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [recurringWeekly, setRecurringWeekly] = useState(false);
  const [error, setError] = useState("");

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
      photoDataUrl: attachments.photoDataUrl,
      pdfDataUrl: attachments.pdfDataUrl,
      pdfFileName: attachments.pdfFileName,
      extractedText:
        attachments.extractedText.trim() ||
        description.trim() ||
        `Läxa: ${title}. Ämne: ${subject}.`,
      reminderEnabled,
      recurringWeekly,
    };
    upsertHomework(hw);
    if (reminderEnabled) {
      ensureHomeworkReminder(hw, reminderTime || "09:00");
      const cal = loadData().calendarEvents.find(
        (e) => e.homeworkId === hw.id && e.type === "homework" && e.date === hw.dueDate,
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
          Spara läxan nu — ladda upp foto/PDF direkt eller senare inför förhör.
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
            <label className="label">
              {recurringWeekly ? "Första datum" : "Datum"}
            </label>
            <input
              type="date"
              className="input-field"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={recurringWeekly}
            onChange={(e) => setRecurringWeekly(e.target.checked)}
          />
          Återkommer varje vecka
        </label>
        {recurringWeekly && (
          <p className="text-xs text-muted">
            Syns i kalendern varje vecka på samma veckodag. När du markerar
            klar flyttas deadline till nästa vecka.
          </p>
        )}

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

        <HomeworkAttachments
          value={attachments}
          onChange={(next) =>
            setAttachments({
              photoDataUrl: next.photoDataUrl,
              pdfDataUrl: next.pdfDataUrl,
              pdfFileName: next.pdfFileName,
              extractedText: next.extractedText,
            })
          }
        />

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

        <button type="submit" className="btn-primary">
          Spara läxa
        </button>
      </form>
    </div>
  );
}
