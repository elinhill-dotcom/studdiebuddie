export type Subject =
  | "Matematik"
  | "Svenska"
  | "Engelska"
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
  extractedText: string;
  reminderEnabled: boolean;
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
  createdAt: string;
}

export interface AppData {
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
