"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { notifyDataChanged, useAppData } from "@/components/useAppData";
import { TimeInput24 } from "@/components/TimeInput24";
import { formatDateTime } from "@/lib/helpers";
import {
  canUseNotifications,
  registerNotificationWorker,
  requestNotificationPermission,
  showReminderNotification,
} from "@/lib/notifications";
import {
  deleteReminder,
  setNotificationsEnabled,
  upsertReminder,
  upsertHomework,
  upsertVocabList,
} from "@/lib/store";
import type { Reminder, HomeworkAttachment, Homework } from "@/lib/types";
import { timingFromDate, reminderAt } from "@/lib/reminder-time";
import { HomeworkAttachments, attachmentValueFromHomework } from "@/components/HomeworkAttachments";
import { withMirroredAttachmentFields } from "@/lib/attachments";
import { extractHomeworkVocab } from "@/lib/vocab-material";

export default function PaminnelserPage() {
  return <Suspense fallback={<p>Laddar…</p>}><ReminderPage /></Suspense>;
}

function ReminderPage() {
  const params = useSearchParams();
  const { data, ready, refresh } = useAppData();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState(params.get("date") || "");
  const [time, setTime] = useState("17:00");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [target, setTarget] = useState(params.get("vocab") ? "existing" : params.get("new") === "vocab" ? "new" : "none");
  const [vocabId, setVocabId] = useState(params.get("vocab") || "");
  const [homeworkId, setHomeworkId] = useState("");
  const [languageFrom, setLanguageFrom] = useState("engelska");
  const [material, setMaterial] = useState({ attachments: [] as HomeworkAttachment[], extractedText: "" });
  const [saving, setSaving] = useState(false);

  if (!ready) return <p className="text-muted">Laddar…</p>;

  const enableNotifications = async () => {
    if (!canUseNotifications()) {
      setStatus("Din webbläsare stödjer inte notiser.");
      return;
    }
    await registerNotificationWorker();
    const perm = await requestNotificationPermission();
    if (perm !== "granted") {
      setStatus(
        "Tillåt notiser i webbläsaren (och gärna “Lägg till på hemskärmen” på mobilen).",
      );
      setNotificationsEnabled(false);
      notifyDataChanged();
      refresh();
      return;
    }
    setNotificationsEnabled(true);
    notifyDataChanged();
    refresh();
    await showReminderNotification(
      "Studdiebuddie",
      "Notiser är igång. Du får påminnelser på den här enheten.",
    );
    setStatus("Notiser aktiverade.");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!title.trim() || !date) return;
    const at = reminderAt(date, time, { choice: "custom", date, time });
    if (!at || Date.parse(at) <= Date.now()) {
      setStatus("Välj ett datum och klockslag som ligger framåt i tiden.");
      return;
    }
    if (target === "existing" && !data.vocabLists.some(v => v.id === vocabId)) { setStatus("Välj en gloslista."); return; }
    setSaving(true);
    let linkedHomeworkId = editing?.homeworkId;
    let url = editing?.url;
    let completion = "Påminnelse sparad.";
    try {
      if (target !== "none") {
        const listId = target === "new" ? crypto.randomUUID() : vocabId;
        const sourceLanguage = target === "existing" ? data.vocabLists.find(v => v.id === listId)?.languageFrom || languageFrom : languageFrom;
        const previousLink = data.reminders.find(r => r.url === `/glosor/${listId}` && r.homeworkId);
        const existingHw = data.homeworks.find(h => h.id === (homeworkId || previousLink?.homeworkId));
        const hw: Homework = withMirroredAttachmentFields(existingHw ? { ...existingHw, attachments: attachmentValueFromHomework(existingHw).attachments, ...(homeworkId ? material : material.attachments.length || material.extractedText.trim() ? { attachments: [...attachmentValueFromHomework(existingHw).attachments, ...material.attachments], extractedText: [existingHw.extractedText, material.extractedText].filter(Boolean).join("\n\n") } : {}) } : {
          id: crypto.randomUUID(), title: title.trim(), subject: sourceLanguage === "spanska" ? "Spanska" : sourceLanguage === "tyska" ? "Tyska" : "Engelska",
          dueDate: date, createdAt: new Date().toISOString(), status: "todo", description: "", helpNeeded: "", pageHints: "", reminderEnabled: false, ...material,
        });
        upsertHomework(hw);
        linkedHomeworkId = hw.id;
        url = `/glosor/${listId}`;
        if (target === "new") {
          let pairs: import("@/lib/types").VocabPair[] = [];
          if (hw.attachments?.length || hw.extractedText.trim()) {
            try { pairs = await extractHomeworkVocab(hw, languageFrom, "svenska"); completion = `Påminnelse och ${pairs.length} glosor sparade. Öppna gloslistan för att kontrollera orden och spela.`; }
            catch { completion = "Påminnelsen och materialet är sparade. Orden kunde inte läsas in nu – öppna gloslistan och försök igen eller skriv in dem."; }
          } else completion = "Glospåminnelse sparad. Öppna gloslistan för att lägga till material när du har det.";
          const now = new Date().toISOString();
          upsertVocabList({ id: listId, title: title.trim(), languageFrom, languageTo: "svenska", pairs, createdAt: now, updatedAt: now });
        }
      } else if (editing?.url?.startsWith("/glosor/")) { url = undefined; linkedHomeworkId = undefined; }
    const reminder: Reminder = {
      ...editing,
      id: editing?.id || crypto.randomUUID(),
      title: title.trim(),
      message: message.trim() || "Dags att plugga.",
      at,
      enabled: true,
      notified: false,
      createdAt: editing?.createdAt || new Date().toISOString(),
      homeworkId: linkedHomeworkId,
      url,
    };
    upsertReminder(reminder);
    notifyDataChanged();
    refresh();
    setTitle("");
    setMessage("");
    setDate("");
    setTime("17:00");
    setEditing(null);
    setTarget("none"); setVocabId(""); setHomeworkId(""); setMaterial({ attachments: [], extractedText: "" });
    setStatus(completion);
    } catch { setStatus("Kunde inte spara allt. Kontrollera uppgifterna och försök igen."); }
    finally { setSaving(false); }
  };

  const remove = (id: string) => {
    deleteReminder(id);
    notifyDataChanged();
    refresh();
  };

  const upcoming = [...data.reminders].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="animate-rise">
        <p className="label">Mobil</p>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Påminnelser
        </h1>
        <p className="mt-2 text-ink-soft">
          Skapa egna notiser till dig själv — inför pluggpass, läxor eller prov.
        </p>
      </div>

      <section className="panel animate-rise-2 space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-medium">Notiser på mobilen</h2>
            <p className="mt-1 text-sm text-muted">
              {data.notificationsEnabled
                ? "Aktiverade på den här enheten."
                : "Behöver tillåtelse för att nå dig utanför appen."}
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={enableNotifications}>
            {data.notificationsEnabled ? "Testa notis" : "Aktivera notiser"}
          </button>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Ha appen öppen för att få påminnelser när tiden är inne. Om appen är
          stängd visas missade påminnelser nästa gång du öppnar den och notiser
          är tillåtna. Du kan ändra tiderna under Dina påminnelser.
        </p>
        {status && <p className="text-sm text-sage">{status}</p>}
      </section>

      <form id="reminder-form" onSubmit={save} className="panel scroll-mt-24 space-y-4 p-5 sm:p-6">
        <fieldset disabled={saving} className="space-y-4">
        <h2 className="font-display text-xl font-medium">{editing ? "Ändra påminnelse" : "Ny påminnelse"}</h2>
        <label className="block space-y-2 text-sm"><span className="font-medium">Vad vill du bli påmind om?</span><select className="input-field" value={target} onChange={e => setTarget(e.target.value)}><option value="none">En vanlig påminnelse</option><option value="existing">Träna en sparad gloslista</option><option value="new">Ny glosläxa – material nu eller senare</option></select></label>
        {target === "existing" && <label className="block space-y-2 text-sm">Gloslista<select className="input-field" value={vocabId} onChange={e => { setVocabId(e.target.value); const list = data.vocabLists.find(v => v.id === e.target.value); if (list && !title.trim()) setTitle(`Träna ${list.title}`); }}><option value="">Välj gloslista</option>{data.vocabLists.map(v => <option value={v.id} key={v.id}>{v.title}</option>)}</select></label>}
        {target !== "none" && <div className="space-y-3 rounded-2xl bg-sage-soft/30 p-4">
          {target === "new" && <label className="block text-sm">Glosornas språk<select className="input-field mt-1" value={languageFrom} onChange={e => setLanguageFrom(e.target.value)}>{["engelska", "spanska", "tyska", "franska"].map(l => <option key={l}>{l}</option>)}</select></label>}
          <label className="block text-sm">Koppla till läxa<select className="input-field mt-1" value={homeworkId} onChange={e => { setHomeworkId(e.target.value); const hw = data.homeworks.find(h => h.id === e.target.value); setMaterial(hw ? attachmentValueFromHomework(hw) : { attachments: [], extractedText: "" }); }}><option value="">Skapa eller använd gloslistans läxa</option>{data.homeworks.map(h => <option value={h.id} key={h.id}>{h.title}</option>)}</select></label>
          <p className="text-xs text-muted">Materialet kopplas till läxan. Du kan spara utan fil och lägga till den senare från gloslistan.</p>
          <HomeworkAttachments value={material} onChange={setMaterial} />
        </div>}
        <div>
          <label className="label">Titel</label>
          <input
            className="input-field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="T.ex. Plugga matte 30 min"
          />
        </div>
        <div>
          <label className="label">Meddelande</label>
          <input
            className="input-field"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Valfri text i notisen"
          />
        </div>
        <div>
          <label className="label">När</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              className="input-field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <TimeInput24 value={time} onChange={setTime} />
          </div>
        </div>
        <button type="submit" className="btn-primary">
          {saving ? "Sparar och läser material…" : editing ? "Spara ändringar" : "Spara påminnelse"}
        </button>
        {editing && <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setTitle(""); setMessage(""); setDate(""); setTime("17:00"); setTarget("none"); setVocabId(""); setHomeworkId(""); setMaterial({ attachments: [], extractedText: "" }); setStatus(""); }}>Avbryt</button>}
        </fieldset>
      </form>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-medium">Dina påminnelser</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">Inga påminnelser ännu.</p>
        ) : (
          <ul className="panel divide-y divide-[var(--line)]">
            {upcoming.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-sm text-muted">{r.message}</p>
                  <p className="mt-1 text-xs text-brass">{formatDateTime(r.at)}</p>
                  {r.url?.startsWith("/glosor/") && <Link className="mt-2 inline-block text-sm text-sage underline" href={r.url}>Öppna glosor · material & spel →</Link>}
                  {r.notified && (
                    <p className="mt-1 text-xs text-muted">Skickad</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                <button type="button" className="btn-secondary text-sm" onClick={() => {
                  const timing = timingFromDate(r.at);
                  setEditing(r); setTitle(r.title); setMessage(r.message); setDate(timing.date); setTime(timing.time); setStatus("");
                  setTarget(r.url?.startsWith("/glosor/") ? "existing" : "none"); setVocabId(r.url?.startsWith("/glosor/") ? r.url.split("/")[2] : ""); setHomeworkId(r.homeworkId || ""); const hw = data.homeworks.find(h => h.id === r.homeworkId); setMaterial(hw ? attachmentValueFromHomework(hw) : { attachments: [], extractedText: "" });
                  document.getElementById("reminder-form")?.scrollIntoView({ behavior: "smooth" });
                }}>Ändra</button>
                <button
                  type="button"
                  className="btn-ghost text-danger"
                  onClick={() => remove(r.id)}
                >
                  Ta bort
                </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
