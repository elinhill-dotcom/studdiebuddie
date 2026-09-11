"use client";

import type {
  AppData,
  CalendarEvent,
  ExamResult,
  HomeModuleId,
  Homework,
  Note,
  QuizSession,
  Reminder,
  VocabList,
} from "./types";
import { DEFAULT_HOME_MODULES } from "./types";

const STORAGE_KEY = "studdiebuddie-v2";

export type CloudSyncHandlers = {
  onHomeworkUpsert?: (hw: Homework) => void;
  onHomeworkDelete?: (id: string) => void;
  onNoteUpsert?: (note: Note) => void;
  onNoteDelete?: (id: string) => void;
  onCalendarUpsert?: (event: CalendarEvent) => void;
  onCalendarDelete?: (id: string) => void;
  onReminderUpsert?: (reminder: Reminder) => void;
  onReminderDelete?: (id: string) => void;
  onVocabUpsert?: (list: VocabList) => void;
  onVocabDelete?: (id: string) => void;
  onQuizUpsert?: (session: QuizSession) => void;
  onExamUpsert?: (result: ExamResult) => void;
  onProfileChange?: (
    name: string,
    modules: string[],
    notifications: boolean,
  ) => void;
};

let cloudSync: CloudSyncHandlers | null = null;

export function registerCloudSync(handlers: CloudSyncHandlers | null) {
  cloudSync = handlers;
}

export const emptyData = (): AppData => ({
  homeworks: [],
  notes: [],
  quizSessions: [],
  examResults: [],
  calendarEvents: [],
  reminders: [],
  vocabLists: [],
  notificationsEnabled: false,
  homeModules: [...DEFAULT_HOME_MODULES],
  profileName: "Buddie",
});

export function loadData(): AppData {
  if (typeof window === "undefined") return emptyData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // migrera v1 om den finns
      const v1 = localStorage.getItem("studdiebuddie-v1");
      if (v1) {
        const parsed = JSON.parse(v1);
        const merged: AppData = {
          ...emptyData(),
          ...parsed,
          calendarEvents: parsed.calendarEvents || [],
          reminders: parsed.reminders || [],
          vocabLists: parsed.vocabLists || [],
          notificationsEnabled: parsed.notificationsEnabled || false,
          homeModules: parsed.homeModules?.length
            ? parsed.homeModules
            : [...DEFAULT_HOME_MODULES],
        };
        saveData(merged);
        return merged;
      }
      return emptyData();
    }
    const parsed = JSON.parse(raw);
    return {
      ...emptyData(),
      ...parsed,
      vocabLists: parsed.vocabLists || [],
      homeModules: parsed.homeModules?.length
        ? parsed.homeModules
        : [...DEFAULT_HOME_MODULES],
    } as AppData;
  } catch {
    return emptyData();
  }
}

export function setHomeModules(modules: HomeModuleId[]): AppData {
  const data = loadData();
  data.homeModules = modules;
  saveData(data);
  cloudSync?.onProfileChange?.(
    data.profileName,
    data.homeModules,
    data.notificationsEnabled,
  );
  return data;
}

export function setProfileName(name: string): AppData {
  const data = loadData();
  data.profileName = name.trim() || "Buddie";
  saveData(data);
  cloudSync?.onProfileChange?.(
    data.profileName,
    data.homeModules,
    data.notificationsEnabled,
  );
  return data;
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function upsertHomework(hw: Homework): AppData {
  const data = loadData();
  const idx = data.homeworks.findIndex((h) => h.id === hw.id);
  if (idx >= 0) data.homeworks[idx] = hw;
  else data.homeworks.unshift(hw);
  saveData(data);
  cloudSync?.onHomeworkUpsert?.(hw);
  return data;
}

export function deleteHomework(id: string): AppData {
  const data = loadData();
  data.homeworks = data.homeworks.filter((h) => h.id !== id);
  saveData(data);
  cloudSync?.onHomeworkDelete?.(id);
  return data;
}

export function upsertNote(note: Note): AppData {
  const data = loadData();
  const idx = data.notes.findIndex((n) => n.id === note.id);
  if (idx >= 0) data.notes[idx] = note;
  else data.notes.unshift(note);
  saveData(data);
  cloudSync?.onNoteUpsert?.(note);
  return data;
}

export function deleteNote(id: string): AppData {
  const data = loadData();
  data.notes = data.notes.filter((n) => n.id !== id);
  saveData(data);
  cloudSync?.onNoteDelete?.(id);
  return data;
}

export function upsertQuiz(session: QuizSession): AppData {
  const data = loadData();
  const idx = data.quizSessions.findIndex((q) => q.id === session.id);
  if (idx >= 0) data.quizSessions[idx] = session;
  else data.quizSessions.unshift(session);
  saveData(data);
  cloudSync?.onQuizUpsert?.(session);
  return data;
}

export function upsertExam(result: ExamResult): AppData {
  const data = loadData();
  const idx = data.examResults.findIndex((e) => e.id === result.id);
  if (idx >= 0) data.examResults[idx] = result;
  else data.examResults.unshift(result);
  saveData(data);
  cloudSync?.onExamUpsert?.(result);
  return data;
}

export function upsertCalendarEvent(event: CalendarEvent): AppData {
  const data = loadData();
  const idx = data.calendarEvents.findIndex((e) => e.id === event.id);
  if (idx >= 0) data.calendarEvents[idx] = event;
  else data.calendarEvents.unshift(event);
  saveData(data);
  cloudSync?.onCalendarUpsert?.(event);
  return data;
}

export function deleteCalendarEvent(id: string): AppData {
  const data = loadData();
  data.calendarEvents = data.calendarEvents.filter((e) => e.id !== id);
  data.reminders = data.reminders.filter((r) => r.eventId !== id);
  saveData(data);
  cloudSync?.onCalendarDelete?.(id);
  return data;
}

export function upsertReminder(reminder: Reminder): AppData {
  const data = loadData();
  const idx = data.reminders.findIndex((r) => r.id === reminder.id);
  if (idx >= 0) data.reminders[idx] = reminder;
  else data.reminders.unshift(reminder);
  saveData(data);
  cloudSync?.onReminderUpsert?.(reminder);
  return data;
}

export function deleteReminder(id: string): AppData {
  const data = loadData();
  data.reminders = data.reminders.filter((r) => r.id !== id);
  saveData(data);
  cloudSync?.onReminderDelete?.(id);
  return data;
}

export function setNotificationsEnabled(enabled: boolean): AppData {
  const data = loadData();
  data.notificationsEnabled = enabled;
  saveData(data);
  cloudSync?.onProfileChange?.(
    data.profileName,
    data.homeModules,
    data.notificationsEnabled,
  );
  return data;
}

export function upsertVocabList(list: VocabList): AppData {
  const data = loadData();
  const idx = data.vocabLists.findIndex((v) => v.id === list.id);
  if (idx >= 0) data.vocabLists[idx] = list;
  else data.vocabLists.unshift(list);
  saveData(data);
  cloudSync?.onVocabUpsert?.(list);
  return data;
}

export function deleteVocabList(id: string): AppData {
  const data = loadData();
  data.vocabLists = data.vocabLists.filter((v) => v.id !== id);
  saveData(data);
  cloudSync?.onVocabDelete?.(id);
  return data;
}

export function seedDemoIfEmpty(): AppData {
  const data = loadData();
  if (data.homeworks.length > 0 || data.calendarEvents.length > 0) {
    if (data.vocabLists.length === 0) {
      data.vocabLists = [demoVocabList()];
      saveData(data);
    }
    return data;
  }

  const now = new Date();
  const in3 = new Date(now);
  in3.setDate(in3.getDate() + 3);
  const in7 = new Date(now);
  in7.setDate(in7.getDate() + 7);
  const in10 = new Date(now);
  in10.setDate(in10.getDate() + 10);
  const studyDay = new Date(now);
  studyDay.setDate(studyDay.getDate() + 2);

  const hw1 = crypto.randomUUID();
  const hw2 = crypto.randomUUID();
  const examId = crypto.randomUUID();
  const studyId = crypto.randomUUID();

  const demo: AppData = {
    ...data,
    profileName: "Buddie",
    homeworks: [
      {
        id: hw1,
        title: "Bråk – övningar 1–10",
        subject: "Matematik",
        dueDate: in3.toISOString().slice(0, 10),
        createdAt: now.toISOString(),
        status: "todo",
        description: "Räkna ut bråk med gemensam nämnare.",
        helpNeeded: "Hur man hittar minsta gemensamma nämnare",
        pageHints: "sid 4–5 i mattehäftet",
        extractedText:
          "1. Beräkna 1/2 + 1/4.\n2. Förenkla 6/8.\n3. Vad är 3/5 av 20?\nTips: Läs mer om gemensam nämnare på sidan 4 i ditt häfte.",
        reminderEnabled: true,
      },
      {
        id: hw2,
        title: "Vikingarna – läs kapitel 2",
        subject: "Historia",
        dueDate: in7.toISOString().slice(0, 10),
        createdAt: now.toISOString(),
        status: "doing",
        description: "Läs och anteckna tre viktiga saker om vikingarna.",
        helpNeeded: "Skillnaden mellan handel och plundring",
        pageHints: "sid 12 i historieboken",
        extractedText:
          "Vikingarna levde cirka 800–1050. De seglade med långskepp, handlade och ibland plundrade. De hade bondebyar i Skandinavien och reste långt till Island, England och Bysans.",
        reminderEnabled: true,
      },
    ],
    calendarEvents: [
      {
        id: studyId,
        title: "Pluggpass: bråk",
        type: "study",
        date: studyDay.toISOString().slice(0, 10),
        time: "17:00",
        subject: "Matematik",
        homeworkId: hw1,
        notes: "30 minuter, lugn plats",
        createdAt: now.toISOString(),
      },
      {
        id: crypto.randomUUID(),
        title: "Läxa inlämning",
        type: "homework",
        date: in3.toISOString().slice(0, 10),
        subject: "Matematik",
        homeworkId: hw1,
        createdAt: now.toISOString(),
      },
      {
        id: examId,
        title: "Matteprov – bråk",
        type: "exam",
        date: in10.toISOString().slice(0, 10),
        time: "09:00",
        subject: "Matematik",
        notes: "Ta med linjal och penna",
        createdAt: now.toISOString(),
      },
    ],
    reminders: [],
    vocabLists: [demoVocabList()],
    notes: [
      {
        id: crypto.randomUUID(),
        title: "Att plugga mer",
        body: "Gemensam nämnare. Vikingarnas långskepp.",
        updatedAt: now.toISOString(),
        createdAt: now.toISOString(),
      },
    ],
  };

  saveData(demo);
  return demo;
}

function demoVocabList(): VocabList {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "Engelska – unit 1",
    languageFrom: "engelska",
    languageTo: "svenska",
    pairs: [
      { id: crypto.randomUUID(), term: "apple", translation: "äpple" },
      { id: crypto.randomUUID(), term: "beautiful", translation: "vacker" },
      { id: crypto.randomUUID(), term: "quickly", translation: "snabbt" },
      { id: crypto.randomUUID(), term: "friend", translation: "vän" },
      { id: crypto.randomUUID(), term: "homework", translation: "läxa" },
      { id: crypto.randomUUID(), term: "tomorrow", translation: "imorgon" },
    ],
    createdAt: now,
    updatedAt: now,
  };
}
