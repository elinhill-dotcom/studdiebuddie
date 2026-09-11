import type { User } from "@supabase/supabase-js";
import type {
  AppData,
  CalendarEvent,
  ExamResult,
  Homework,
  Note,
  QuizSession,
  Reminder,
  VocabList,
} from "@/lib/types";
import { DEFAULT_HOME_MODULES } from "@/lib/types";
import { createClient } from "./client";

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string; mime: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1];
  const b64 = match[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  let ext = "bin";
  if (mime.startsWith("image/")) {
    ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  } else if (mime === "application/pdf") {
    ext = "pdf";
  }
  return { blob: new Blob([bytes], { type: mime }), ext, mime };
}

async function uploadHomeworkFile(
  userId: string,
  homeworkId: string,
  dataUrl: string | undefined,
  kind: "image" | "pdf",
): Promise<string | null> {
  if (!dataUrl?.startsWith("data:")) return null;
  if (kind === "image" && !dataUrl.startsWith("data:image")) return null;
  if (kind === "pdf" && !dataUrl.startsWith("data:application/pdf")) return null;

  const supabase = createClient();
  if (!supabase) return null;
  const parsed = dataUrlToBlob(dataUrl);
  if (!parsed) return null;

  const path = `${userId}/${homeworkId}.${parsed.ext}`;
  const { error } = await supabase.storage
    .from("homework-photos")
    .upload(path, parsed.blob, { upsert: true, contentType: parsed.mime });

  if (error) {
    console.error("file upload", error.message);
    return null;
  }
  return path;
}

async function signedFileUrl(path: string | null | undefined) {
  if (!path) return undefined;
  const supabase = createClient();
  if (!supabase) return undefined;
  const { data } = await supabase.storage
    .from("homework-photos")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl || undefined;
}

export async function syncHomeworkToCloud(hw: Homework, user: User) {
  const supabase = createClient();
  if (!supabase) return;

  let photoPath: string | null = null;
  let pdfPath: string | null = null;

  if (hw.photoDataUrl?.startsWith("data:image")) {
    photoPath = await uploadHomeworkFile(user.id, hw.id, hw.photoDataUrl, "image");
  }
  if (hw.pdfDataUrl?.startsWith("data:application/pdf")) {
    pdfPath = await uploadHomeworkFile(user.id, hw.id, hw.pdfDataUrl, "pdf");
  }

  const row: Record<string, unknown> = {
    id: hw.id,
    user_id: user.id,
    title: hw.title,
    subject: hw.subject,
    due_date: hw.dueDate,
    status: hw.status,
    description: hw.description,
    help_needed: hw.helpNeeded,
    page_hints: hw.pageHints,
    extracted_text: hw.extractedText,
    reminder_enabled: hw.reminderEnabled,
    created_at: hw.createdAt,
  };
  if (photoPath) row.photo_path = photoPath;
  if (pdfPath) {
    row.pdf_path = pdfPath;
    row.pdf_file_name = hw.pdfFileName || "laxa.pdf";
  }

  const { error } = await supabase.from("homeworks").upsert(row);
  if (error) console.error("sync homework", error.message);
}

export async function deleteHomeworkFromCloud(id: string) {
  const supabase = createClient();
  if (!supabase) return;
  await supabase.from("homeworks").delete().eq("id", id);
}

export async function syncNoteToCloud(note: Note, user: User) {
  const supabase = createClient();
  if (!supabase) return;
  const { error } = await supabase.from("notes").upsert({
    id: note.id,
    user_id: user.id,
    title: note.title,
    body: note.body,
    subject: note.subject ?? null,
    homework_id: note.homeworkId ?? null,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  });
  if (error) console.error("sync note", error.message);
}

export async function deleteNoteFromCloud(id: string) {
  const supabase = createClient();
  if (!supabase) return;
  await supabase.from("notes").delete().eq("id", id);
}

export async function syncCalendarEventToCloud(
  event: CalendarEvent,
  user: User,
) {
  const supabase = createClient();
  if (!supabase) return;
  const { error } = await supabase.from("calendar_events").upsert({
    id: event.id,
    user_id: user.id,
    title: event.title,
    type: event.type,
    date: event.date,
    time: event.time ?? null,
    subject: event.subject ?? null,
    notes: event.notes ?? null,
    homework_id: event.homeworkId ?? event.homeworkIds?.[0] ?? null,
    homework_ids: event.homeworkIds ?? [],
    created_at: event.createdAt,
  });
  if (error) console.error("sync calendar", error.message);
}

export async function deleteCalendarEventFromCloud(id: string) {
  const supabase = createClient();
  if (!supabase) return;
  await supabase.from("calendar_events").delete().eq("id", id);
}

export async function syncReminderToCloud(reminder: Reminder, user: User) {
  const supabase = createClient();
  if (!supabase) return;
  const { error } = await supabase.from("reminders").upsert({
    id: reminder.id,
    user_id: user.id,
    title: reminder.title,
    message: reminder.message,
    at: reminder.at,
    enabled: reminder.enabled,
    notified: reminder.notified,
    event_id: reminder.eventId ?? null,
    homework_id: reminder.homeworkId ?? null,
    link_url: reminder.url ?? null,
    created_at: reminder.createdAt,
  });
  if (error) console.error("sync reminder", error.message);
}

export async function deleteReminderFromCloud(id: string) {
  const supabase = createClient();
  if (!supabase) return;
  await supabase.from("reminders").delete().eq("id", id);
}

export async function syncVocabListToCloud(list: VocabList, user: User) {
  const supabase = createClient();
  if (!supabase) return;

  const { error: listErr } = await supabase.from("vocab_lists").upsert({
    id: list.id,
    user_id: user.id,
    title: list.title,
    language_from: list.languageFrom,
    language_to: list.languageTo,
    created_at: list.createdAt,
    updated_at: list.updatedAt,
  });
  if (listErr) {
    console.error("sync vocab list", listErr.message);
    return;
  }

  await supabase.from("vocab_pairs").delete().eq("list_id", list.id);
  if (list.pairs.length) {
    const { error: pairErr } = await supabase.from("vocab_pairs").insert(
      list.pairs.map((p) => ({
        id: p.id,
        list_id: list.id,
        user_id: user.id,
        term: p.term,
        translation: p.translation,
      })),
    );
    if (pairErr) console.error("sync vocab pairs", pairErr.message);
  }
}

export async function deleteVocabListFromCloud(id: string) {
  const supabase = createClient();
  if (!supabase) return;
  await supabase.from("vocab_lists").delete().eq("id", id);
}

export async function syncQuizSessionToCloud(
  session: QuizSession,
  user: User,
) {
  const supabase = createClient();
  if (!supabase) return;
  const { error } = await supabase.from("quiz_sessions").upsert({
    id: session.id,
    user_id: user.id,
    homework_ids: session.homeworkIds,
    vocab_list_id: session.vocabListId ?? null,
    mode: session.mode,
    title: session.title,
    questions: session.questions,
    answers: session.answers,
    started_at: session.startedAt,
    finished_at: session.finishedAt ?? null,
    score_percent: session.scorePercent ?? null,
  });
  if (error) console.error("sync quiz", error.message);
}

export async function syncExamResultToCloud(result: ExamResult, user: User) {
  const supabase = createClient();
  if (!supabase) return;
  const { error } = await supabase.from("exam_results").upsert({
    id: result.id,
    user_id: user.id,
    title: result.title,
    subject: result.subject,
    date: result.date,
    score_percent: result.scorePercent,
    reflection: result.reflection,
    weak_topics: result.weakTopics,
    related_homework_ids: result.relatedHomeworkIds,
    created_at: result.createdAt,
  });
  if (error) console.error("sync exam", error.message);
}

export async function syncProfileToCloud(
  user: User,
  profileName: string,
  homeModules: string[],
  notificationsEnabled: boolean,
) {
  const supabase = createClient();
  if (!supabase) return;
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: profileName,
    home_modules: homeModules,
    notifications_enabled: notificationsEnabled,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("sync profile", error.message);
}

/** Ladda all molndata för inloggad användare → AppData */
export async function loadCloudAppData(user: User): Promise<AppData | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const [
    profileRes,
    hwRes,
    notesRes,
    calRes,
    remRes,
    vocabRes,
    pairsRes,
    quizRes,
    examRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("homeworks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("notes").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("calendar_events").select("*").eq("user_id", user.id),
    supabase.from("reminders").select("*").eq("user_id", user.id),
    supabase.from("vocab_lists").select("*").eq("user_id", user.id),
    supabase.from("vocab_pairs").select("*").eq("user_id", user.id),
    supabase.from("quiz_sessions").select("*").eq("user_id", user.id).order("started_at", { ascending: false }),
    supabase.from("exam_results").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  const homeworks: Homework[] = await Promise.all(
    (hwRes.data || []).map(async (row) => ({
      id: row.id,
      title: row.title,
      subject: row.subject,
      dueDate: row.due_date,
      createdAt: row.created_at,
      status: row.status,
      description: row.description || "",
      helpNeeded: row.help_needed || "",
      pageHints: row.page_hints || "",
      photoDataUrl: await signedFileUrl(row.photo_path),
      pdfDataUrl: await signedFileUrl(row.pdf_path),
      pdfFileName: row.pdf_file_name || undefined,
      extractedText: row.extracted_text || "",
      reminderEnabled: Boolean(row.reminder_enabled),
    })),
  );

  const pairsByList = new Map<string, { id: string; term: string; translation: string }[]>();
  for (const p of pairsRes.data || []) {
    const list = pairsByList.get(p.list_id) || [];
    list.push({ id: p.id, term: p.term, translation: p.translation });
    pairsByList.set(p.list_id, list);
  }

  const vocabLists: VocabList[] = (vocabRes.data || []).map((v) => ({
    id: v.id,
    title: v.title,
    languageFrom: v.language_from,
    languageTo: v.language_to,
    pairs: pairsByList.get(v.id) || [],
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  }));

  const profile = profileRes.data;

  return {
    homeworks,
    notes: (notesRes.data || []).map(
      (n): Note => ({
        id: n.id,
        title: n.title,
        body: n.body || "",
        subject: n.subject || undefined,
        homeworkId: n.homework_id || undefined,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      }),
    ),
    calendarEvents: (calRes.data || []).map(
      (e): CalendarEvent => ({
        id: e.id,
        title: e.title,
        type: e.type,
        date: e.date,
        time: e.time || undefined,
        subject: e.subject || undefined,
        notes: e.notes || undefined,
        homeworkId: e.homework_id || undefined,
        homeworkIds: Array.isArray(e.homework_ids)
          ? e.homework_ids
          : e.homework_id
            ? [e.homework_id]
            : undefined,
        createdAt: e.created_at,
      }),
    ),
    reminders: (remRes.data || []).map(
      (r): Reminder => ({
        id: r.id,
        title: r.title,
        message: r.message || "",
        at: r.at,
        enabled: Boolean(r.enabled),
        notified: Boolean(r.notified),
        eventId: r.event_id || undefined,
        homeworkId: r.homework_id || undefined,
        url: r.link_url || undefined,
        createdAt: r.created_at,
      }),
    ),
    vocabLists,
    quizSessions: (quizRes.data || []).map(
      (q): QuizSession => ({
        id: q.id,
        homeworkIds: q.homework_ids || [],
        vocabListId: q.vocab_list_id || undefined,
        mode: q.mode,
        title: q.title,
        questions: q.questions || [],
        answers: q.answers || [],
        startedAt: q.started_at,
        finishedAt: q.finished_at || undefined,
        scorePercent: q.score_percent ?? undefined,
      }),
    ),
    examResults: (examRes.data || []).map(
      (e): ExamResult => ({
        id: e.id,
        title: e.title,
        subject: e.subject,
        date: e.date,
        scorePercent: e.score_percent,
        reflection: e.reflection || "",
        weakTopics: e.weak_topics || [],
        relatedHomeworkIds: e.related_homework_ids || [],
        createdAt: e.created_at,
      }),
    ),
    notificationsEnabled: Boolean(profile?.notifications_enabled),
    homeModules: Array.isArray(profile?.home_modules)
      ? profile.home_modules
      : [...DEFAULT_HOME_MODULES],
    profileName: profile?.display_name || "Buddie",
  };
}

/** Pusha lokal data till molnet (t.ex. första inloggning) */
export async function pushLocalDataToCloud(data: AppData, user: User) {
  await syncProfileToCloud(
    user,
    data.profileName,
    data.homeModules,
    data.notificationsEnabled,
  );
  for (const hw of data.homeworks) await syncHomeworkToCloud(hw, user);
  for (const n of data.notes) await syncNoteToCloud(n, user);
  for (const e of data.calendarEvents) await syncCalendarEventToCloud(e, user);
  for (const r of data.reminders) await syncReminderToCloud(r, user);
  for (const v of data.vocabLists) await syncVocabListToCloud(v, user);
  for (const q of data.quizSessions) await syncQuizSessionToCloud(q, user);
  for (const e of data.examResults) await syncExamResultToCloud(e, user);
}
