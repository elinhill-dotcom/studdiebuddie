"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { notifyDataChanged, useAppData } from "@/components/useAppData";
import { dueLabel, statusLabel } from "@/lib/helpers";
import { deleteHomework, upsertHomework } from "@/lib/store";
import type { HomeworkStatus } from "@/lib/types";

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
    setStatus(s);
    upsertHomework({ ...hw, status: s });
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
          {hw.reminderEnabled && (
            <span className="text-xs text-brass">{dueLabel(hw.dueDate)}</span>
          )}
        </div>

        <h1 className="font-display text-3xl font-medium tracking-tight">
          {hw.title}
        </h1>
        <p className="text-ink-soft">{hw.description}</p>

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

        {hw.photoDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hw.photoDataUrl}
            alt="Foto av läxa"
            className="max-h-64 rounded-xl object-contain"
          />
        )}

        {hw.extractedText && (
          <div>
            <h2 className="font-display text-lg font-medium">Material</h2>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-white/50 p-4 text-sm leading-relaxed text-ink-soft">
              {hw.extractedText}
            </pre>
          </div>
        )}

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
              {statusLabel(s)}
            </button>
          ))}
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
