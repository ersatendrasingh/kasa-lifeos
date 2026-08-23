import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiFetch } from "@/lib/api-client";

export const KASA_NOTIFICATION_SOUND = "kasa-tone.wav";
export const NOTIFICATION_CHANGED_EVENT = "kasa:notifications-changed";

export type KasaNotification = {
  id: string;
  title: string;
  body: string | null;
  channel: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  readAt: string | null;
  metadata: unknown;
  createdAt: string;
};

type NotificationList = {
  notifications: KasaNotification[];
  unreadCount: number;
};

let notificationListRequest: Promise<NotificationList> | null = null;

export async function listNotifications() {
  if (notificationListRequest) return notificationListRequest;
  notificationListRequest = (async () => {
    const response = await apiFetch<NotificationList>("/api/notifications");
    if (response.error) throw new Error(response.error.message);
    return response.data ?? { notifications: [], unreadCount: 0 };
  })();
  try {
    return await notificationListRequest;
  } finally {
    notificationListRequest = null;
  }
}

export async function setNotificationRead(id: string, read: boolean) {
  const response = await apiFetch(`/api/notifications/${id}`, {
    method: "PATCH",
    body: { read },
  });
  if (response.error) throw new Error(response.error.message);
}

export async function markAllNotificationsRead() {
  const response = await apiFetch("/api/notifications", {
    method: "PATCH",
    body: { action: "read-all" },
  });
  if (response.error) throw new Error(response.error.message);
}

export async function createTestNotification() {
  const response = await apiFetch("/api/notifications", { method: "POST" });
  if (response.error) throw new Error(response.error.message);
  const allowed = await ensureNotificationPermission();
  if (!allowed)
    throw new Error(
      "Enable notifications in iPhone Settings to hear KASA alerts.",
    );
  await syncLocalNotifications();
}

export async function deleteNotification(id: string) {
  const response = await apiFetch(`/api/notifications/${id}`, {
    method: "DELETE",
  });
  if (response.error) throw new Error(response.error.message);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.serverNotificationId === id)
      .map((item) =>
        Notifications.cancelScheduledNotificationAsync(item.identifier),
      ),
  );
}

export async function clearNotifications(scope: "read" | "all") {
  const response = await apiFetch(`/api/notifications?scope=${scope}`, {
    method: "DELETE",
  });
  if (response.error) throw new Error(response.error.message);
  if (scope === "all") {
    await Promise.all([
      Notifications.cancelAllScheduledNotificationsAsync(),
      Notifications.dismissAllNotificationsAsync(),
      Notifications.setBadgeCountAsync(0),
    ]);
  }
}

export async function configureNativeNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("kasa-reminders", {
      name: "KASA reminders",
      description: "Bills, renewals, medicines and important life reminders",
      importance: Notifications.AndroidImportance.HIGH,
      sound: KASA_NOTIFICATION_SOUND,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: "#FF6338",
    });
  }
}

export async function ensureNotificationPermission() {
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
  return permission.granted;
}

export async function syncLocalNotifications() {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  await configureNativeNotifications();

  const response = await apiFetch<{
    notifications: Array<{
      id: string;
      title: string;
      body: string | null;
      scheduledAt: string;
    }>;
  }>("/api/notifications/sync");
  if (response.error || !response.data?.notifications.length) return;

  const alreadyScheduled =
    await Notifications.getAllScheduledNotificationsAsync();
  const known = new Set(
    alreadyScheduled.map((item) => item.content.data?.serverNotificationId),
  );
  const syncedIds: string[] = [];

  for (const item of response.data.notifications) {
    if (!known.has(item.id)) {
      const scheduledAt = new Date(item.scheduledAt);
      const future = scheduledAt.getTime() > Date.now() + 1_000;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.body ?? "KASA remembered this for you.",
          sound: KASA_NOTIFICATION_SOUND,
          data: { serverNotificationId: item.id, url: "/notifications" },
          interruptionLevel: "active",
        },
        trigger: future
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: scheduledAt,
              channelId: "kasa-reminders",
            }
          : null,
      });
    }
    syncedIds.push(item.id);
  }

  const receipt = await apiFetch("/api/notifications/sync", {
    method: "PATCH",
    body: { ids: syncedIds },
  });
  if (receipt.error) throw new Error(receipt.error.message);
  const latest = await listNotifications();
  await Notifications.setBadgeCountAsync(latest.unreadCount);
}
