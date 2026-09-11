"use client";

import Link from "next/link";
import { useAppData } from "@/components/useAppData";
import { HomeworkCard } from "@/components/HomeworkCard";

export default function LaxorPage() {
  const { data, ready } = useAppData();
  if (!ready) return <p className="text-muted">Laddar…</p>;

  const sorted = [...data.homeworks].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
            Läxor
          </h1>
          <p className="mt-1 text-muted">Planera, fota och håll koll på deadlinen.</p>
        </div>
        <Link href="/laxor/ny" className="btn-primary">
          Ny läxa
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="panel px-6 py-10 text-center">
          <p className="text-muted">Inga läxor ännu.</p>
          <Link href="/laxor/ny" className="btn-primary mt-4 inline-flex">
            Skapa din första
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((hw) => (
            <HomeworkCard key={hw.id} hw={hw} />
          ))}
        </div>
      )}
    </div>
  );
}
