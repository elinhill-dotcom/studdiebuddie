"use client";

import Link from "next/link";
import type { Homework } from "@/lib/types";
import { dueLabel, statusLabel } from "@/lib/helpers";

export function HomeworkCard({ hw }: { hw: Homework }) {
  return (
    <Link
      href={`/laxor/${hw.id}`}
      className="panel block px-4 py-3 transition hover:-translate-y-0.5 hover:bg-white/90"
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="tag">{hw.subject}</span>
        <span className="text-xs text-muted">{statusLabel(hw.status)}</span>
        {hw.recurringWeekly && (
          <span className="tag bg-sky-soft text-sky">Varje vecka</span>
        )}
        {hw.reminderEnabled && (
          <span className="ml-auto text-xs font-semibold text-coral">
            {dueLabel(hw.dueDate)}
          </span>
        )}
      </div>
      <h3 className="font-display text-lg font-semibold leading-snug tracking-tight">
        {hw.title}
      </h3>
      <p className="mt-0.5 line-clamp-2 text-sm text-muted">{hw.description}</p>
    </Link>
  );
}
