export type Subject =
  | "Matematik"
  | "Svenska"
  | "Engelska"
  | "Spanska"
  | "Tyska"
  | "NO"
  | "SO"
  | "Historia"
  | "Annat";

export type HomeworkStatus = "todo" | "doing" | "done";

export type CalendarEventType = "exam" | "study" | "homework";

export type HomeModuleId =
  | "calendar"
  | "homework"
  | "reminders"
  | "focus"
  | "shortcuts";

export interface Homework {
  id: string;
  title: string;
  subject: Subject;
  dueDate: string;
  createdAt: string;
  status: HomeworkStatus;
  description: string;
  helpNeeded: string;
  pageHints: string;
  photoDataUrl?: string;
  /** Base64 data URL eller signerad länk till PDF */
  pdfDataUrl?: string;
  pdfFileName?: string;
  /** Flera filer (bilder/PDF). Legacy-fälten speglas från första av varje typ. */
  attachments?: HomeworkAttachment[];
  extractedText: string;
  reminderEnabled: boolean;
  /** Samma läxa varje vecka (samma veckodag) */
  recurringWeekly?: boolean;
}

export interface HomeworkAttachment {
  id: string;
  kind: "image" | "pdf";
  /** data URL lokalt, signerad URL efter sync */
  dataUrl: string;
  fileName?: string;
  /** Utläst text från PDF (eller tom för bild) */
  extractedText?: string;
  /** Storage-sökväg i Supabase (efter uppladdning) */
  storagePath?: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  subject?: Subject;
  homeworkId?: string;
  updatedAt: string;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  expectedAnswer: string;
  tip?: string;
  topic?: string;
  rewrittenFromId?: string;
}

export interface QuizAttemptAnswer {
  questionId: string;
  userAnswer: string;
  correct: boolean;
  feedback?: string;
}

export interface QuizSession {
  id: string;
  homeworkIds: string[];
  vocabListId?: string;
  mode: "single" | "retry" | "summary" | "vocab";
  title: string;
  questions: QuizQuestion[];
  answers: QuizAttemptAnswer[];
  startedAt: string;
  finishedAt?: string;
  scorePercent?: number;
}

export interface VocabPair {
  id: string;
  term: string;
  translation: string;
}

export interface VocabList {
  id: string;
  title: string;
  languageFrom: string;
  languageTo: string;
  pairs: VocabPair[];
  createdAt: string;
  updatedAt: string;
}

export interface ExamResult {
  id: string;
  title: string;
  subject: Subject;
  date: string;
  scorePercent: number;
  reflection: string;
  weakTopics: string[];
  relatedHomeworkIds: string[];
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  date: string;
  time?: string;
  subject?: Subject;
  notes?: string;
  homeworkId?: string;
  /** Flera läxor kopplade till plugg/prov-plan */
  homeworkIds?: string[];
  createdAt: string;
}

export interface Reminder {
  id: string;
  title: string;
  message: string;
  at: string;
  enabled: boolean;
  notified: boolean;
  eventId?: string;
  homeworkId?: string;
  /** Deep-länk t.ex. till förhör */
  url?: string;
  createdAt: string;
}

export interface AppData {
  /** Ägare — används så data aldrig blandas mellan konton */
  ownerUserId?: string | null;
  homeworks: Homework[];
  notes: Note[];
  quizSessions: QuizSession[];
  examResults: ExamResult[];
  calendarEvents: CalendarEvent[];
  reminders: Reminder[];
  vocabLists: VocabList[];
  notificationsEnabled: boolean;
  /** Vilka moduler som syns på startsidan */
  homeModules: HomeModuleId[];
  profileName: string;
}

export const DEFAULT_HOME_MODULES: HomeModuleId[] = [
  "shortcuts",
  "calendar",
  "homework",
  "reminders",
  "focus",
];

export const HOME_MODULE_META: Record<
  HomeModuleId,
  { label: string; hint: string }
> = {
  shortcuts: { label: "Genvägar", hint: "Snabba knappar" },
  calendar: { label: "Kalender", hint: "Prov & läxtillfällen" },
  homework: { label: "Läxor", hint: "Aktiva läxor" },
  reminders: { label: "Påminnelser", hint: "Kommande notiser" },
  focus: { label: "Fokus", hint: "Vad att plugga mer" },
};
