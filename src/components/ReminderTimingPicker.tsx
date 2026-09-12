"use client";

import { TimeInput24 } from "./TimeInput24";
import { REMINDER_CHOICES, reminderAt, type ReminderTiming } from "@/lib/reminder-time";

export function ReminderTimingPicker({ value, onChange, eventDate, eventTime, label = "När vill du bli påmind?", allowCustom = true }: {
  value: ReminderTiming; onChange: (value: ReminderTiming) => void; eventDate: string; eventTime: string; label?: string; allowCustom?: boolean;
}) {
  const at = reminderAt(eventDate, eventTime, value);
  return <div className="space-y-2 rounded-xl bg-lilac-soft/40 p-3">
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <select className="input-field" value={value.choice} onChange={e => onChange({ ...value, choice: e.target.value })}>
        {REMINDER_CHOICES.filter(([key]) => allowCustom || key !== "custom").map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
    </label>
    {value.choice === "custom" && <div className="flex flex-wrap gap-2">
      <label className="min-w-0 flex-1 space-y-1 text-xs">Datum för påminnelsen<input type="date" required className="input-field" value={value.date} onChange={e => onChange({ ...value, date: e.target.value })} /></label>
      <label className="space-y-1 text-xs">Klockslag<TimeInput24 value={value.time} onChange={time => onChange({ ...value, time })} /></label>
    </div>}
    {at && <p className="text-xs text-muted">Påminnelse: {new Date(at).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" })}</p>}
  </div>;
}
