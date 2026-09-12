"use client";

import { useState } from "react";
import type { CalendarEvent, Reminder } from "@/lib/types";
import { loadData, upsertHomework, upsertReminder } from "@/lib/store";
import { reminderAt, timingFromDate, type ReminderTiming } from "@/lib/reminder-time";
import { ReminderTimingPicker } from "./ReminderTimingPicker";
import { notifyDataChanged } from "./useAppData";

export function CalendarReminderEditor({ event, reminder, onChange }: { event: CalendarEvent; reminder?: Reminder; onChange: () => void }) {
  const [enabled, setEnabled] = useState(!!reminder?.enabled);
  const [timing, setTiming] = useState<ReminderTiming>(() => reminder ? timingFromDate(reminder.at) : { choice: "60", date: event.date, time: "17:00" });
  const [status, setStatus] = useState("");
  function save(e: React.FormEvent) {
    e.preventDefault();
    const at = reminderAt(event.date, event.time || "09:00", timing);
    if (enabled && (!at || Date.parse(at) <= Date.now())) {
      setStatus("Välj en påminnelsetid som ligger framåt i tiden.");
      return;
    }
    if (enabled || reminder) upsertReminder({
      ...reminder, id: reminder?.id || crypto.randomUUID(), title: reminder?.title || event.title,
      message: reminder?.message || `Kom ihåg: ${event.title}.`, at: enabled ? at! : reminder!.at,
      enabled, notified: enabled ? false : !!reminder?.notified, eventId: event.id, homeworkId: event.homeworkId,
      url: reminder?.url || (event.homeworkId && event.type === "homework" ? `/laxor/${event.homeworkId}` : "/hem"),
      createdAt: reminder?.createdAt || new Date().toISOString(),
    });
    if (event.type === "homework" && event.homeworkId) {
      const hw = loadData().homeworks.find(h => h.id === event.homeworkId);
      if (hw) upsertHomework({ ...hw, reminderEnabled: enabled });
    }
    notifyDataChanged();
    onChange();
    setStatus(enabled ? "Påminnelsen är sparad." : "Påminnelsen är avstängd.");
  }
  return <details className="mt-2 border-t border-[var(--line)] pt-2">
    <summary className="cursor-pointer text-xs text-sage">{reminder?.enabled ? `Påminnelse ${new Date(reminder.at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })} · ändra` : "Lägg till påminnelse"}</summary>
    <form onSubmit={save} className="mt-2 space-y-2">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Påminn mig</label>
      {enabled && <ReminderTimingPicker value={timing} onChange={setTiming} eventDate={event.date} eventTime={event.time || "09:00"} />}
      <button className="btn-secondary text-xs">Spara påminnelse</button>
      {status && <p role="status" className="text-xs">{status}</p>}
    </form>
  </details>;
}
