/** Mobilnotiser via Notification API + service worker */

export async function registerNotificationWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export async function showReminderNotification(
  title: string,
  body: string,
  url?: string,
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const targetUrl = url || "/hem";
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg?.showNotification) {
    await reg.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: `studdiebuddie-${Date.now()}`,
      requireInteraction: true,
      data: { url: targetUrl },
    });
    return;
  }

  new Notification(title, { body });
}

export function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}
