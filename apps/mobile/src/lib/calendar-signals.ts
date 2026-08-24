import * as Calendar from "expo-calendar/legacy";
import * as Notifications from "expo-notifications";

import { type CalendarItem } from "@/lib/automation";
import {
  configureNativeNotifications,
  ensureNotificationPermission,
  KASA_NOTIFICATION_SOUND,
} from "@/lib/notifications";

const birthdayPattern = /\b(birthday|bday|janamdin|birth anniversary)\b/i;

function monthRange(month: Date) {
  const from = new Date(month.getFullYear(), month.getMonth(), 1);
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  return { from, to };
}

function toBirthdayItem(event: Calendar.Event): CalendarItem | null {
  if (!birthdayPattern.test(event.title || "")) return null;
  return {
    id: `birthday:${event.id}:${new Date(event.startDate).toISOString()}`,
    type: "BIRTHDAY",
    title: event.title.replace(birthdayPattern, "").trim() || "Birthday",
    detail: "From your device calendar",
    date: new Date(event.startDate).toISOString(),
    allDay: event.allDay,
  };
}

export async function getDeviceBirthdays(month: Date, requestAccess = false) {
  let permission = await Calendar.getCalendarPermissionsAsync();
  if (!permission.granted && requestAccess && permission.canAskAgain) {
    permission = await Calendar.requestCalendarPermissionsAsync();
  }
  if (!permission.granted)
    return { items: [] as CalendarItem[], allowed: false };

  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  const { from, to } = monthRange(month);
  const events = await Calendar.getEventsAsync(
    calendars.map((calendar) => calendar.id),
    from,
    to,
  );
  return {
    items: events
      .map(toBirthdayItem)
      .filter((item): item is CalendarItem => Boolean(item)),
    allowed: true,
  };
}

export async function scheduleCalendarGreetings(
  items: CalendarItem[],
  requestPermission = false,
) {
  const allowed = requestPermission
    ? await ensureNotificationPermission()
    : (await Notifications.getPermissionsAsync()).granted;
  if (!allowed) return false;
  await configureNativeNotifications();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const known = new Set(
    scheduled.map(
      (notification) => notification.content.data?.calendarSignalId,
    ),
  );
  for (const item of items) {
    if (
      (item.type !== "BIRTHDAY" && item.type !== "FESTIVAL") ||
      known.has(item.id)
    )
      continue;
    const date = new Date(item.date);
    date.setHours(9, 0, 0, 0);
    if (date.getTime() <= Date.now()) continue;
    const birthday = item.type === "BIRTHDAY";
    await Notifications.scheduleNotificationAsync({
      content: {
        title: birthday ? `It’s ${item.title}` : item.title,
        body: birthday
          ? "A warm wish is ready—make their day feel remembered."
          : "A festival reminder from your KASA calendar.",
        sound: KASA_NOTIFICATION_SOUND,
        data: { calendarSignalId: item.id, url: "/calendar" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: "kasa-reminders",
      },
    });
  }
  return true;
}
