"use client";

import Link from "next/link";
import { useState } from "react";
import type { Homework } from "@/lib/types";
import { dueLabel, statusLabel } from "@/lib/helpers";

export function HomeworkCard({ hw, onDelete }: { hw: Homework; onDelete?: () => void }) {
  const [offset, setOffset] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  const [swiping, setSwiping] = useState(false);
  const reveal = offset < -56;
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <button type="button" className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-danger text-sm font-semibold text-white" onClick={onDelete}>
        Radera
      </button>
      <Link
        href={`/laxor/${hw.id}`}
        onTouchStart={(e) => { setStartX(e.touches[0].clientX); setSwiping(false); }}
        onTouchMove={(e) => { if (startX === null) return; const dx = e.touches[0].clientX - startX; if (dx < 0) { setOffset(Math.max(-96, dx)); setSwiping(true); } }}
        onTouchEnd={() => { setOffset(reveal ? -96 : 0); setStartX(null); }}
        onClick={(e) => { if (swiping) e.preventDefault(); }}
        className="panel relative block px-4 py-3 transition-transform hover:bg-white/90"
        style={{ transform: `translateX(${offset}px)` }}
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
    </div>
  );
}
