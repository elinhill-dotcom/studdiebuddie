"use client";

import { useEffect } from "react";
import { loadData, upsertReminder } from "@/lib/store";
import {
  registerNotificationWorker,
  showReminderNotification,
} from "@/lib/notifications";
import { notifyDataChanged } from "@/components/useAppData";

/** Kollar förfallna påminnelser och skickar mobilnotis */
export function ReminderWatcher() {
  useEffect(() => {
    registerNotificationWorker();

    const tick = async () => {
      const data = loadData();
      if (!data.notificationsEnabled) return;
      if (typeof Notification === "undefined" || Notification.permission !== "granted") {
        return;
      }

      const now = Date.now();
      for (const r of data.reminders) {
        if (!r.enabled || r.notified) continue;
        const when = new Date(r.at).getTime();
        if (Number.isNaN(when) || when > now) continue;

        await showReminderNotification(
          r.title,
          r.message || "Dags att plugga.",
          r.url,
        );
        upsertReminder({ ...r, notified: true });
        notifyDataChanged();
      }
    };

    tick();
    const id = window.setInterval(tick, 20_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
