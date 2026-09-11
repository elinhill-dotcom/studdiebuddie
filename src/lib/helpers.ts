import type { Homework, HomeworkStatus, Subject } from "@/lib/types";

export const SUBJECTS: Subject[] = [
  "Matematik",
  "Svenska",
  "Engelska",
  "Spanska",
  "Tyska",
  "NO",
  "SO",
  "Historia",
  "Annat",
];

export function statusLabel(s: HomeworkStatus) {
  if (s === "todo") return "Att göra";
  if (s === "doing") return "Pågår";
  return "Klar";
}

export function daysUntil(dueDate: string) {
  const due = new Date(dueDate + "T12:00:00");
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function dueLabel(dueDate: string) {
  const d = daysUntil(dueDate);
  if (d < 0) return `${Math.abs(d)} dagar sen`;
  if (d === 0) return "Idag";
  if (d === 1) return "Imorgon";
  return `Om ${d} dagar`;
}

/** YYYY-MM-DD + N dagar (lokal middag för att undvika DST-problem) */
export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Nästa N veckodatum inklusive start (för återkommande läxor) */
export function weeklyOccurrenceDates(startIso: string, count = 12): string[] {
  return Array.from({ length: count }, (_, i) => addDaysIso(startIso, i * 7));
}

/** Har läxan material som Buddie kan använda till förhör? */
export function hasQuizMaterial(hw: Homework) {
  return Boolean(
    hw.extractedText?.trim() ||
      hw.description?.trim() ||
      hw.photoDataUrl ||
      hw.pdfDataUrl,
  );
}

/** Har läxan uppladdad fil (foto/PDF)? */
export function hasHomeworkFiles(hw: Homework) {
  return Boolean(hw.photoDataUrl || hw.pdfDataUrl);
}

export function upcomingReminders(homeworks: Homework[]) {
  return homeworks
    .filter((h) => h.reminderEnabled && h.status !== "done")
    .filter((h) => daysUntil(h.dueDate) <= 3)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function weakTopicsFromResults(
  examResults: { weakTopics: string[] }[],
  quizSessions: {
    answers: { correct: boolean; questionId: string }[];
    questions: { id: string; topic?: string }[];
  }[],
) {
  const map = new Map<string, number>();
  for (const e of examResults) {
    for (const t of e.weakTopics) {
      map.set(t, (map.get(t) || 0) + 2);
    }
  }
  for (const q of quizSessions) {
    for (const a of q.answers) {
      if (!a.correct) {
        const topic =
          q.questions.find((x) => x.id === a.questionId)?.topic || "Okänt";
        map.set(topic, (map.get(topic) || 0) + 1);
      }
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([topic, count]) => ({ topic, count }));
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
