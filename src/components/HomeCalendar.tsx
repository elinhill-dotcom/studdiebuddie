"use client";

import { useMemo, useState } from "react";
import type {
  CalendarEvent,
  CalendarEventType,
  Homework,
  Reminder,
  Subject,
} from "@/lib/types";
import { SUBJECTS } from "@/lib/helpers";
import {
  deleteCalendarEvent,
  upsertCalendarEvent,
  upsertReminder,
} from "@/lib/store";
import { notifyDataChanged } from "@/components/useAppData";
import { ExamPlanner } from "@/components/ExamPlanner";
import { TimeInput24 } from "@/components/TimeInput24";
import Link from "next/link";

const WEEKDAYS = ["M", "T", "O", "T", "F", "L", "S"];

const typeLabel: Record<CalendarEventType, string> = {
  exam: "Prov",
  study: "Plugg",
  homework: "Deadline",
};

type DayMark = "exam" | "study" | "homework" | "reminder";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function mondayIndex(d: Date) {
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthTitle(d: Date) {
  return d.toLocaleDateString("sv-SE", { month: "short", year: "numeric" });
}

function reminderDateKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return toKey(d);
}

const markColor: Record<DayMark, string> = {
  exam: "bg-brass",
  study: "bg-sky",
  homework: "bg-sage",
  reminder: "bg-lilac",
};

const markColorOnSelected: Record<DayMark, string> = {
  exam: "bg-white",
  study: "bg-white/90",
  homework: "bg-white/75",
  reminder: "bg-white/60",
};

/** Kompakt kalendermodul med synliga pluppar */
export function HomeCalendar({
  events,
  homeworks = [],
  reminders = [],
  onChange,
}: {
  events: CalendarEvent[];
  homeworks?: Homework[];
  reminders?: Reminder[];
  onChange: () => void;
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => toKey(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [showExamPlan, setShowExamPlan] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CalendarEventType>("study");
  const [time, setTime] = useState("17:00");
  const [subject, setSubject] = useState<Subject>("Matematik");
  const [withReminder, setWithReminder] = useState(true);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  /** Pluppar: kalenderhändelser + läxdeadlines + egna påminnelser */
  const marksByDate = useMemo(() => {
    const map = new Map<string, Set<DayMark>>();
    const add = (key: string, mark: DayMark) => {
      const set = map.get(key) || new Set<DayMark>();
      set.add(mark);
      map.set(key, set);
    };

    for (const e of events) {
      add(e.date, e.type);
    }
    for (const hw of homeworks) {
      if (hw.status === "done") continue;
      add(hw.dueDate, "homework");
    }
    for (const r of reminders) {
      if (!r.enabled) continue;
      const key = reminderDateKey(r.at);
      if (key) add(key, "reminder");
    }
    return map;
  }, [events, homeworks, reminders]);

  const cells = useMemo(() => {
    const total = daysInMonth(cursor);
    const offset = mondayIndex(startOfMonth(cursor));
    const items: ({ day: number; key: string } | null)[] = [];
    for (let i = 0; i < offset; i++) items.push(null);
    for (let day = 1; day <= total; day++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      items.push({ day, key });
    }
    while (items.length % 7 !== 0) items.push(null);
    return items;
  }, [cursor]);

  const selectedEvents = byDate.get(selected) || [];
  const selectedHomework = homeworks.filter(
    (h) => h.dueDate === selected && h.status !== "done",
  );
  const selectedReminders = reminders.filter((r) => {
    if (!r.enabled) return false;
    return reminderDateKey(r.at) === selected;
  });
  const todayKey = toKey(new Date());

  const saveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const event: CalendarEvent = {
      id: crypto.randomUUID(),
      title: title.trim(),
      type,
      date: selected,
      time: time || undefined,
      subject,
      createdAt: new Date().toISOString(),
    };
    upsertCalendarEvent(event);
    if (withReminder) {
      const base = new Date(`${selected}T${time || "09:00"}:00`);
      upsertReminder({
        id: crypto.randomUUID(),
        title: type === "exam" ? `Prov: ${event.title}` : event.title,
        message: `Dags för ${event.title}.`,
        at: new Date(base.getTime() - 60 * 60_000).toISOString(),
        enabled: true,
        notified: false,
        eventId: event.id,
        createdAt: new Date().toISOString(),
      });
    }
    notifyDataChanged();
    onChange();
    setTitle("");
    setShowForm(false);
  };

  return (
    <div className="panel panel-tint-sky overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="module-dot bg-sky" />
          <h2 className="font-display text-lg font-semibold tracking-tight capitalize">
            {monthTitle(cursor)}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn-ghost px-2 text-sm"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
            }
          >
            ←
          </button>
          <button
            type="button"
            className="btn-ghost px-2 text-xs"
            onClick={() => {
              const n = new Date();
              setCursor(startOfMonth(n));
              setSelected(toKey(n));
            }}
          >
            Idag
          </button>
          <button
            type="button"
            className="btn-ghost px-2 text-sm"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
            }
          >
            →
          </button>
        </div>
      </div>

      <div className="p-3">
        <div className="mb-1 grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((d, i) => (
            <div
              key={`${d}-${i}`}
              className="py-0.5 text-center text-[10px] font-semibold text-muted"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`e-${i}`} className="h-9" />;
            const marks = [...(marksByDate.get(cell.key) || [])];
            const hasMarks = marks.length > 0;
            const isSelected = cell.key === selected;
            const isToday = cell.key === todayKey;
            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => {
                  setSelected(cell.key);
                  setShowForm(false);
                }}
                className={`relative flex h-9 flex-col items-center justify-center rounded-lg text-xs font-medium transition ${
                  isSelected
                    ? "bg-sky text-white ring-2 ring-sky ring-offset-1 ring-offset-[var(--pearl)]"
                    : hasMarks
                      ? isToday
                        ? "bg-sky-soft text-sky ring-2 ring-sky/70"
                        : "bg-white/90 text-ink ring-2 ring-sage/55"
                      : isToday
                        ? "bg-sky-soft text-sky"
                        : "hover:bg-white/80"
                }`}
              >
                <span className={hasMarks ? "mb-0.5" : ""}>{cell.day}</span>
                {hasMarks && (
                  <span className="absolute bottom-1 flex items-center gap-0.5">
                    {marks.slice(0, 3).map((m) => (
                      <span
                        key={m}
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSelected ? markColorOnSelected[m] : markColor[m]
                        }`}
                        aria-hidden
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-brass" /> Prov
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sky" /> Plugg
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sage" /> Läxa
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-lilac" /> Påminnelse
          </span>
        </div>
      </div>

      <div className="space-y-2 border-t border-[var(--line)] px-3 pb-3 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          {new Date(selected + "T12:00:00").toLocaleDateString("sv-SE", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </p>

        {selectedEvents.map((ev) => {
          const hwIds = ev.homeworkIds?.length
            ? ev.homeworkIds
            : ev.homeworkId
              ? [ev.homeworkId]
              : [];
          const forhorHref =
            hwIds.length > 0
              ? `/forhor/start?homeworks=${hwIds.join(",")}`
              : null;
          return (
            <div
              key={ev.id}
              className="space-y-1 rounded-lg bg-white/70 px-2.5 py-1.5 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span
                    className={`tag mr-1.5 ${
                      ev.type === "exam"
                        ? "tag-exam"
                        : ev.type === "study"
                          ? "tag-study"
                          : "tag-homework"
                    }`}
                  >
                    {typeLabel[ev.type]}
                  </span>
                  <span className="font-medium">{ev.title}</span>
                  {ev.time && (
                    <span className="ml-1 text-xs text-muted">{ev.time}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-ghost px-1.5 text-xs text-danger"
                  onClick={() => {
                    deleteCalendarEvent(ev.id);
                    notifyDataChanged();
                    onChange();
                  }}
                >
                  ×
                </button>
              </div>
              {forhorHref && (ev.type === "study" || ev.type === "exam") && (
                <Link
                  href={forhorHref}
                  className="text-xs font-semibold text-coral hover:underline"
                >
                  Starta läxförhör →
                </Link>
              )}
            </div>
          );
        })}

        {selectedHomework.map((hw) => (
          <div
            key={hw.id}
            className="rounded-lg bg-white/70 px-2.5 py-1.5 text-sm"
          >
            <span className="tag tag-homework mr-1.5">Läxa</span>
            <span className="font-medium">{hw.title}</span>
          </div>
        ))}

        {selectedReminders.map((r) => (
          <div
            key={r.id}
            className="rounded-lg bg-white/70 px-2.5 py-1.5 text-sm"
          >
            <span className="tag mr-1.5 bg-lilac-soft text-lilac">Påminnelse</span>
            <span className="font-medium">{r.title}</span>
          </div>
        ))}

        {selectedEvents.length === 0 &&
          selectedHomework.length === 0 &&
          selectedReminders.length === 0 &&
          !showForm &&
          !showExamPlan && (
            <p className="text-xs text-muted">Inget inbokat den här dagen.</p>
          )}

        {!showForm && !showExamPlan ? (
          <div className="grid gap-2">
            <button
              type="button"
              className="btn-primary w-full py-1.5 text-sm"
              onClick={() => setShowExamPlan(true)}
            >
              Planera prov + plugg
            </button>
            <button
              type="button"
              className="btn-secondary w-full py-1.5 text-sm"
              onClick={() => setShowForm(true)}
            >
              + Lägg till
            </button>
          </div>
        ) : showExamPlan ? (
          <ExamPlanner
            homeworks={homeworks}
            defaultExamDate={selected}
            onDone={() => {
              setShowExamPlan(false);
              onChange();
            }}
            onCancel={() => setShowExamPlan(false)}
          />
        ) : (
          <form onSubmit={saveEvent} className="space-y-2 rounded-xl bg-white/80 p-2.5">
            <input
              className="input-field py-1.5 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="input-field py-1.5 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as CalendarEventType)}
              >
                <option value="exam">Prov</option>
                <option value="study">Läxtillfälle</option>
                <option value="homework">Deadline</option>
              </select>
              <TimeInput24 value={time} onChange={setTime} className="w-full" />
            </div>
            <select
              className="input-field py-1.5 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value as Subject)}
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={withReminder}
                onChange={(e) => setWithReminder(e.target.checked)}
              />
              Påminnelse 1 h innan
            </label>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary py-1.5 text-sm">
                Spara
              </button>
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => setShowForm(false)}
              >
                Avbryt
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
