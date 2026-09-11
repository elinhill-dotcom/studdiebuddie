"use client";

import { useState } from "react";
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
} from "@/lib/store";
import type { Reminder } from "@/lib/types";

export default function PaminnelserPage() {
  const { data, ready, refresh } = useAppData();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("17:00");
  const [status, setStatus] = useState("");

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

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    const reminder: Reminder = {
      id: crypto.randomUUID(),
      title: title.trim(),
      message: message.trim() || "Dags att plugga.",
      at: new Date(`${date}T${time}:00`).toISOString(),
      enabled: true,
      notified: false,
      createdAt: new Date().toISOString(),
    };
    upsertReminder(reminder);
    notifyDataChanged();
    refresh();
    setTitle("");
    setMessage("");
    setDate("");
    setTime("17:00");
    setStatus("Påminnelse sparad.");
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
          Tips: öppna Studdiebuddie i Safari/Chrome på mobilen och välj “Lägg till
          på hemskärmen”. Då känns notiserna mer som en riktig app. Påminnelser
          skickas när tiden är inne (appen behöver ha körts minst en gång på
          enheten).
        </p>
        {status && <p className="text-sm text-sage">{status}</p>}
      </section>

      <form onSubmit={save} className="panel space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-xl font-medium">Ny påminnelse</h2>
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
          Spara påminnelse
        </button>
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
                  {r.notified && (
                    <p className="mt-1 text-xs text-muted">Skickad</p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-ghost text-danger"
                  onClick={() => remove(r.id)}
                >
                  Ta bort
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
