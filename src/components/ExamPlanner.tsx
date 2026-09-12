"use client";

import { useMemo, useState } from "react";
import type { CalendarEvent, Homework, Reminder, Subject } from "@/lib/types";
import { SUBJECTS, hasQuizMaterial } from "@/lib/helpers";
import {
  setNotificationsEnabled,
  upsertCalendarEvent,
  upsertReminder,
} from "@/lib/store";
import { notifyDataChanged } from "@/components/useAppData";
import { TimeInput24 } from "@/components/TimeInput24";
import { ReminderTimingPicker } from "./ReminderTimingPicker";
import { reminderAt, type ReminderTiming } from "@/lib/reminder-time";
import {
  canUseNotifications,
  requestNotificationPermission,
} from "@/lib/notifications";

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(key: string, delta: number) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return toKey(d);
}

function daysBetween(fromKey: string, toKey: string) {
  const a = new Date(`${fromKey}T12:00:00`).getTime();
  const b = new Date(`${toKey}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function labelDay(key: string) {
  return new Date(`${key}T12:00:00`).toLocaleDateString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function ExamPlanner({
  homeworks,
  defaultExamDate,
  onDone,
  onCancel,
}: {
  homeworks: Homework[];
  defaultExamDate: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<Subject>("Matematik");
  const [examDate, setExamDate] = useState(defaultExamDate);
  const [examTime, setExamTime] = useState("09:00");
  const [studyTime, setStudyTime] = useState("17:00");
  const [selectedHw, setSelectedHw] = useState<string[]>([]);
  const [studyDays, setStudyDays] = useState<string[]>([]);
  const [dayTimes, setDayTimes] = useState<Record<string, string>>({});
  const [wantPush, setWantPush] = useState(true);
  const [examReminder, setExamReminder] = useState<ReminderTiming>({ choice: "60", date: defaultExamDate, time: "17:00" });
  const [studyReminder, setStudyReminder] = useState<ReminderTiming>({ choice: "0", date: "", time: "17:00" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const subjectHomeworks = useMemo(
    () =>
      homeworks.filter(
        (h) => h.subject === subject && h.status !== "done" && hasQuizMaterial(h),
      ),
    [homeworks, subject],
  );

  const candidateDays = useMemo(() => {
    const today = toKey(new Date());
    const span = Math.max(0, daysBetween(today, examDate));
    const keys: string[] = [];
    // Dagar från idag till dagen före provet
    for (let i = 0; i < span; i++) {
      keys.push(addDays(today, i));
    }
    return keys.slice(-14); // max 14 dagar bakåt från provet
  }, [examDate]);

  const toggleHw = (id: string) => {
    setSelectedHw((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleDay = (key: string) => {
    setStudyDays((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((x) => x !== key);
        return next;
      }
      setDayTimes((t) => ({ ...t, [key]: t[key] || studyTime }));
      return [...prev, key].sort();
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Skriv en titel på provet.");
      return;
    }
    if (!selectedHw.length) {
      setError("Välj minst en läxa att öva inför provet.");
      return;
    }
    if (!studyDays.length) {
      setError("Kryssa i minst en pluggdag.");
      return;
    }
    const examReminderAt = reminderAt(examDate, examTime || "09:00", examReminder);
    const studyReminderTimes = studyDays.map(day => reminderAt(day, dayTimes[day] || studyTime, studyReminder));
    if (wantPush && [examReminderAt, ...studyReminderTimes].some(at => !at || Date.parse(at) <= Date.now())) {
      setError("En påminnelse hamnar i dåtid. Välj en senare tid, färre minuter i förväg eller ta bort den passerade pluggdagen.");
      return;
    }

    setBusy(true);
    try {
      if (wantPush && canUseNotifications()) {
        const perm = await requestNotificationPermission();
        if (perm === "granted") {
          setNotificationsEnabled(true);
        }
      }

      const examId = crypto.randomUUID();
      const now = new Date().toISOString();
      const exam: CalendarEvent = {
        id: examId,
        title: title.trim(),
        type: "exam",
        date: examDate,
        time: examTime,
        subject,
        homeworkIds: selectedHw,
        notes: `Pluggplan med ${studyDays.length} dagar`,
        createdAt: now,
      };
      upsertCalendarEvent(exam);

      // Påminnelse enligt elevens val
      if (wantPush) {
        upsertReminder({
          id: crypto.randomUUID(),
          title: `Prov: ${exam.title}`,
          message: `Kom ihåg provet “${exam.title}” den ${examDate} kl. ${examTime}.`,
          at: examReminderAt!,
          enabled: true,
          notified: false,
          eventId: examId,
          url: "/hem",
          createdAt: now,
        } satisfies Reminder);
      }

      const forhorUrl = `/forhor/start?homeworks=${selectedHw.join(",")}`;

      for (const day of studyDays) {
        const time = dayTimes[day] || studyTime;
        const studyId = crypto.randomUUID();
        upsertCalendarEvent({
          id: studyId,
          title: `Plugg: ${title.trim()}`,
          type: "study",
          date: day,
          time,
          subject,
          homeworkIds: selectedHw,
          homeworkId: selectedHw[0],
          notes: `Inför prov ${examDate}`,
          createdAt: now,
        });

        if (wantPush) {
          upsertReminder({
            id: crypto.randomUUID(),
            title: `Dags att plugga: ${title.trim()}`,
            message: `Öva inför provet — öppna förhöret nu.`,
            at: reminderAt(day, time, studyReminder)!,
            enabled: true,
            notified: false,
            eventId: studyId,
            homeworkId: selectedHw[0],
            url: forhorUrl,
            createdAt: now,
          });
        }
      }

      notifyDataChanged();
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={save}
      className="space-y-3 rounded-xl border border-brass/30 bg-white/90 p-3"
    >
      <div>
        <p className="font-display text-base font-semibold text-brass">
          Planera prov + pluggdagar
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Välj läxor, kryssa i pluggdagar och tid — vi skapar kalenderhändelser,
          förhörslänk och pushpåminnelser.
        </p>
      </div>

      <input
        className="input-field py-1.5 text-sm"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Provets titel"
        autoFocus
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          className="input-field py-1.5 text-sm"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value as Subject);
            setSelectedHw([]);
          }}
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="input-field py-1.5 text-sm"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-[11px] text-muted">Provtid</span>
          <TimeInput24 value={examTime} onChange={setExamTime} className="w-full" />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] text-muted">Standard pluggtid</span>
          <TimeInput24
            value={studyTime}
            onChange={(t) => {
              setStudyTime(t);
              setDayTimes((prev) => {
                const next = { ...prev };
                for (const d of studyDays) next[d] = t;
                return next;
              });
            }}
            className="w-full"
          />
        </label>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Läxor till förhör
        </p>
        {subjectHomeworks.length === 0 ? (
          <p className="text-xs text-muted">
            Inga sparade läxor i {subject} med material ännu.
          </p>
        ) : (
          <ul className="max-h-28 space-y-1 overflow-auto">
            {subjectHomeworks.map((hw) => (
              <li key={hw.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[var(--sage)]"
                    checked={selectedHw.includes(hw.id)}
                    onChange={() => toggleHw(hw.id)}
                  />
                  <span>{hw.title}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Pluggdagar (kryssa i)
        </p>
        {candidateDays.length === 0 ? (
          <p className="text-xs text-muted">
            Välj ett provdatum framåt i tiden för att se pluggdagar.
          </p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-auto">
            {candidateDays.map((day) => {
              const on = studyDays.includes(day);
              return (
                <li
                  key={day}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5"
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-[var(--sky)]"
                      checked={on}
                      onChange={() => toggleDay(day)}
                    />
                    <span>{labelDay(day)}</span>
                  </label>
                  {on && (
                    <TimeInput24
                      value={dayTimes[day] || studyTime}
                      onChange={(t) =>
                        setDayTimes((prev) => ({ ...prev, [day]: t }))
                      }
                      className="w-[7.5rem]"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-ink-soft">
        <input
          type="checkbox"
          checked={wantPush}
          onChange={(e) => setWantPush(e.target.checked)}
        />
        Påminn mig om provet och pluggpassen
      </label>
      {wantPush && <div className="space-y-2">
        <ReminderTimingPicker label="Påminnelse inför provet" value={examReminder} onChange={setExamReminder} eventDate={examDate} eventTime={examTime} />
        <ReminderTimingPicker label="Påminnelse inför varje pluggpass" value={studyReminder} onChange={setStudyReminder} eventDate={studyDays[0] || examDate} eventTime={dayTimes[studyDays[0]] || studyTime} allowCustom={false} />
        <p className="text-xs text-muted">Samma framförhållning gäller varje pluggpass. Efteråt kan du ändra varje påminnelse separat i kalendern.</p>
      </div>}

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary py-1.5 text-sm" disabled={busy}>
          {busy ? "Sparar…" : "Skapa plan"}
        </button>
        <button
          type="button"
          className="btn-ghost text-sm"
          onClick={onCancel}
          disabled={busy}
        >
          Avbryt
        </button>
      </div>
    </form>
  );
}
