import * as Notifications from "expo-notifications";

import { apiFetch } from "@/lib/api-client";

export type Responsibility = {
  id: string;
  title: string;
  area: string;
  provider: string | null;
  cadence: "MONTHLY" | "QUARTERLY" | "YEARLY";
  dueDay: number | null;
  nextDueAt: string;
  notificationDays: number[];
  amount: string | null;
  currency: string | null;
  lastPaidAt: string | null;
};

export type ResponsibilityInput = {
  title: string;
  area: string;
  provider?: string | null;
  cadence: "MONTHLY" | "QUARTERLY" | "YEARLY";
  dueDate: string;
  notificationDays: number[];
  amount?: number | null;
};

export async function listResponsibilities() {
  const response = await apiFetch<{ responsibilities: Responsibility[] }>(
    "/api/responsibilities",
  );
  if (response.error) throw new Error(response.error.message);
  return response.data?.responsibilities ?? [];
}

export async function createResponsibility(input: ResponsibilityInput) {
  const response = await apiFetch<{ responsibility: Responsibility }>(
    "/api/responsibilities",
    { method: "POST", body: input },
  );
  if (response.error) throw new Error(response.error.message);
  if (!response.data?.responsibility)
    throw new Error("Could not save this responsibility");
  return response.data.responsibility;
}

export async function payResponsibility(id: string) {
  const response = await apiFetch<{
    responsibility: Responsibility;
    cancelledNotificationIds: string[];
  }>("/api/responsibilities", {
    method: "PATCH",
    body: { action: "paid", id },
  });
  if (response.error) throw new Error(response.error.message);
  await Promise.all(
    (response.data?.cancelledNotificationIds ?? []).map(async (serverId) => {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        scheduled
          .filter(
            (item) => item.content.data?.serverNotificationId === serverId,
          )
          .map((item) =>
            Notifications.cancelScheduledNotificationAsync(item.identifier),
          ),
      );
    }),
  );
  if (!response.data?.responsibility)
    throw new Error("Could not update this responsibility");
  return response.data.responsibility;
}

export async function updateResponsibility(
  id: string,
  input: ResponsibilityInput,
) {
  const response = await apiFetch<{
    responsibility: Responsibility;
    cancelledNotificationIds: string[];
  }>("/api/responsibilities", {
    method: "PATCH",
    body: { action: "update", id, ...input },
  });
  if (response.error) throw new Error(response.error.message);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) =>
        response.data?.cancelledNotificationIds.includes(
          String(item.content.data?.serverNotificationId),
        ),
      )
      .map((item) =>
        Notifications.cancelScheduledNotificationAsync(item.identifier),
      ),
  );
  if (!response.data?.responsibility)
    throw new Error("Could not update this responsibility");
  return response.data.responsibility;
}
