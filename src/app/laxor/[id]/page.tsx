"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { notifyDataChanged, useAppData } from "@/components/useAppData";
import { HomeworkAttachments, attachmentValueFromHomework } from "@/components/HomeworkAttachments";
import { dueLabel, statusLabel } from "@/lib/helpers";
import { withMirroredAttachmentFields } from "@/lib/attachments";
import {
  completeHomeworkOccurrence,
  deleteHomework,
  deleteReminder,
  ensureHomeworkReminder,
  loadData,
  upsertHomework,
} from "@/lib/store";
import type { HomeworkAttachment, HomeworkStatus } from "@/lib/types";

export default function LaxaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, ready, refresh } = useAppData();
  const router = useRouter();
  const [status, setStatus] = useState<HomeworkStatus>("todo");

  const hw = data.homeworks.find((h) => h.id === id);

  useEffect(() => {
    if (hw) setStatus(hw.status);
  }, [hw]);

  if (!ready) return <p className="text-muted">Laddar…</p>;
  if (!hw) {
    return (
      <div className="panel p-6">
        <p>Hittade inte läxan.</p>
        <Link href="/laxor" className="btn-secondary mt-3 inline-flex">
          Tillbaka
        </Link>
      </div>
    );
  }

  const updateStatus = (s: HomeworkStatus) => {
    if (s === "done" && hw.recurringWeekly) {
      completeHomeworkOccurrence(hw);
      setStatus("todo");
      notifyDataChanged();
      refresh();
      return;
    }
    setStatus(s);
    upsertHomework({ ...hw, status: s });
    notifyDataChanged();
    refresh();
  };

  const toggleReminder = () => {
    if (hw.reminderEnabled) {
      const rem = loadData().reminders.filter((r) => r.homeworkId === hw.id);
      for (const r of rem) deleteReminder(r.id);
      upsertHomework({ ...hw, reminderEnabled: false });
    } else {
      upsertHomework({ ...hw, reminderEnabled: true });
      ensureHomeworkReminder({ ...hw, reminderEnabled: true });
    }
    notifyDataChanged();
    refresh();
  };

  const toggleRecurring = () => {
    upsertHomework({ ...hw, recurringWeekly: !hw.recurringWeekly });
    notifyDataChanged();
    refresh();
  };

  const saveAttachments = (patch: {
    attachments: HomeworkAttachment[];
    extractedText: string;
  }) => {
    upsertHomework(
      withMirroredAttachmentFields({
        ...hw,
        attachments: patch.attachments,
        extractedText: patch.extractedText,
      }),
    );
    notifyDataChanged();
    refresh();
  };

  const remove = () => {
    if (!confirm("Ta bort läxan?")) return;
    deleteHomework(hw.id);
    notifyDataChanged();
    router.push("/laxor");
  };

  return (
    <div className="space-y-5">
      <Link href="/laxor" className="text-sm text-muted hover:text-ink">
        ← Alla läxor
      </Link>

      <div className="panel space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tag">{hw.subject}</span>
          <span className="text-xs text-muted">{statusLabel(status)}</span>
          {hw.recurringWeekly && (
            <span className="tag bg-sky-soft text-sky">Varje vecka</span>
          )}
          {hw.reminderEnabled && (
            <span className="text-xs text-brass">{dueLabel(hw.dueDate)}</span>
          )}
        </div>

        <h1 className="font-display text-3xl font-medium tracking-tight">
          {hw.title}
        </h1>
        <p className="text-ink-soft">{hw.description}</p>
        <p className="text-sm text-muted">
          Deadline: <span className="text-ink">{hw.dueDate}</span>
          {hw.recurringWeekly ? " · återkommer varje vecka" : ""}
        </p>

        {hw.helpNeeded && (
          <div className="rounded-xl bg-sage-soft/60 px-4 py-3">
            <p className="label mb-1">Extra hjälp</p>
            <p className="text-sage">{hw.helpNeeded}</p>
          </div>
        )}

        {hw.pageHints && (
          <p className="text-sm text-muted">
            Tips vid fel: <span className="text-ink">{hw.pageHints}</span>
          </p>
        )}

        <div className="rounded-xl border border-[var(--line)] bg-white/50 p-4">
          <h2 className="font-display mb-3 text-lg font-medium">Material</h2>
          <HomeworkAttachments
            value={attachmentValueFromHomework(hw)}
            onChange={saveAttachments}
            optionalHint={false}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(["todo", "doing", "done"] as HomeworkStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updateStatus(s)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                status === s
                  ? "bg-ink text-[var(--pearl)]"
                  : "border border-[var(--line-strong)] text-muted"
              }`}
            >
              {s === "done" && hw.recurringWeekly
                ? "Klar denna vecka"
                : statusLabel(s)}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={Boolean(hw.recurringWeekly)}
              onChange={toggleRecurring}
            />
            Återkommer varje vecka
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={hw.reminderEnabled}
              onChange={toggleReminder}
            />
            Påminnelse 1 h innan deadline
          </label>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <Link href={`/forhor/start?homework=${hw.id}`} className="btn-primary">
            Starta förhör
          </Link>
          <Link href="/anteckningar" className="btn-secondary">
            Anteckna
          </Link>
          <button type="button" onClick={remove} className="btn-ghost text-danger">
            Ta bort
          </button>
        </div>
      </div>
    </div>
  );
}
