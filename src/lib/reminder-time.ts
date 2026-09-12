export type ReminderTiming = { choice: string; date: string; time: string };

export const REMINDER_CHOICES = [
  ["0", "När händelsen börjar"], ["15", "15 minuter innan"],
  ["30", "30 minuter innan"], ["60", "1 timme innan"],
  ["120", "2 timmar innan"], ["1440", "1 dag innan"],
  ["2880", "2 dagar innan"], ["10080", "1 vecka innan"],
  ["custom", "Välj eget datum och tid"],
] as const;

export function reminderAt(date: string, time: string, timing: ReminderTiming): string | null {
  const day = timing.choice === "custom" ? timing.date : date;
  const clock = timing.choice === "custom" ? timing.time : time;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) return null;
  const at = new Date(`${day}T${clock}:00`);
  if (!Number.isFinite(at.getTime())) return null;
  if (timing.choice !== "custom") {
    if (!REMINDER_CHOICES.some(([value]) => value === timing.choice)) return null;
    const minutes = Number(timing.choice);
    // Calendar days preserve local clock time across daylight saving changes.
    if (minutes >= 1440) at.setDate(at.getDate() - minutes / 1440);
    else at.setMinutes(at.getMinutes() - minutes);
  }
  return at.toISOString();
}

export function timingFromDate(iso: string): ReminderTiming {
  const at = new Date(iso);
  return {
    choice: "custom",
    date: `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`,
    time: `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`,
  };
}
