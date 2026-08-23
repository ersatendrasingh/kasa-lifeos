import type { Prisma } from "@/app/generated/prisma/client";

import { db } from "@/lib/db";

export const responsibilityAreas = [
  "HOME",
  "FINANCE",
  "VEHICLE",
  "HEALTH",
  "FAMILY",
  "DOCUMENTS",
  "SUBSCRIPTIONS",
] as const;

export const responsibilityCadences = [
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
] as const;

export type ResponsibilityArea = (typeof responsibilityAreas)[number];
export type ResponsibilityCadence = (typeof responsibilityCadences)[number];

type Transaction = Prisma.TransactionClient;

function localParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(value);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function inTimezone(
  year: number,
  month: number,
  day: number,
  timezone: string,
) {
  const guess = Date.UTC(year, month - 1, day, 9, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(guess));
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value);
  const offset =
    Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
    ) - guess;
  return new Date(guess - offset);
}

export function dateFromKey(key: string, timezone: string) {
  const [year, month, day] = key.split("-").map(Number);
  return inTimezone(year, month, day, timezone);
}

export function nextDueDate(input: {
  dueAt: Date;
  dueDay: number | null;
  cadence: ResponsibilityCadence;
  timezone: string;
}) {
  const current = localParts(input.dueAt, input.timezone);
  const months =
    input.cadence === "MONTHLY" ? 1 : input.cadence === "QUARTERLY" ? 3 : 12;
  const target = new Date(
    Date.UTC(current.year, current.month - 1 + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return inTimezone(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    Math.min(input.dueDay ?? current.day, lastDay),
    input.timezone,
  );
}

async function scheduleNotifications(
  tx: Transaction,
  input: {
    userId: string;
    responsibilityId: string;
    title: string;
    dueAt: Date;
    notificationDays: number[];
  },
) {
  const now = Date.now();
  const days = [...new Set(input.notificationDays)].sort((a, b) => b - a);
  await tx.notification.createMany({
    data: days
      .map((leadDays) => ({
        userId: input.userId,
        channel: "IN_APP" as const,
        title: `${input.title} is due in ${leadDays} day${leadDays === 1 ? "" : "s"}`,
        body: `Due on ${new Intl.DateTimeFormat("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(input.dueAt)}. Mark it paid when it is complete.`,
        scheduledAt: new Date(input.dueAt.getTime() - leadDays * 86_400_000),
        metadata: {
          kind: "RESPONSIBILITY",
          responsibilityId: input.responsibilityId,
          dueAt: input.dueAt.toISOString(),
          leadDays,
        },
      }))
      .filter((notification) => notification.scheduledAt.getTime() > now),
  });
}

export async function createResponsibility(input: {
  userId: string;
  title: string;
  area: ResponsibilityArea;
  provider?: string | null;
  cadence: ResponsibilityCadence;
  dueDate: string;
  notificationDays: number[];
  amount?: number | null;
  timezone: string;
}) {
  return db.$transaction(async (tx) => {
    const dueAt = dateFromKey(input.dueDate, input.timezone);
    const dueDay = Number(input.dueDate.slice(-2));
    const responsibility = await tx.responsibility.create({
      data: {
        userId: input.userId,
        title: input.title,
        area: input.area,
        provider: input.provider || null,
        cadence: input.cadence,
        dueDay,
        nextDueAt: dueAt,
        notificationDays: input.notificationDays,
        amount: input.amount ?? null,
        currency: input.amount ? "INR" : null,
      },
    });
    await scheduleNotifications(tx, {
      userId: input.userId,
      responsibilityId: responsibility.id,
      title: responsibility.title,
      dueAt,
      notificationDays: input.notificationDays,
    });
    return responsibility;
  });
}

export async function payResponsibility(input: {
  userId: string;
  responsibilityId: string;
  timezone: string;
}) {
  return db.$transaction(async (tx) => {
    const responsibility = await tx.responsibility.findFirst({
      where: { id: input.responsibilityId, userId: input.userId, active: true },
    });
    if (!responsibility) return null;

    const pending = await tx.notification.findMany({
      where: {
        userId: input.userId,
        status: "QUEUED",
        scheduledAt: { gte: new Date() },
      },
      select: { id: true, metadata: true },
    });
    const cancelledNotificationIds = pending
      .filter(
        (notification) =>
          typeof notification.metadata === "object" &&
          notification.metadata !== null &&
          !Array.isArray(notification.metadata) &&
          notification.metadata.responsibilityId === responsibility.id,
      )
      .map((notification) => notification.id);
    if (cancelledNotificationIds.length) {
      await tx.notification.updateMany({
        where: { id: { in: cancelledNotificationIds }, userId: input.userId },
        data: { status: "CANCELLED" },
      });
    }

    const nextDueAt = nextDueDate({
      dueAt: responsibility.nextDueAt,
      dueDay: responsibility.dueDay,
      cadence: responsibility.cadence,
      timezone: input.timezone,
    });
    await tx.responsibilityPayment.create({
      data: {
        responsibilityId: responsibility.id,
        dueAt: responsibility.nextDueAt,
        amount: responsibility.amount,
      },
    });
    const updated = await tx.responsibility.update({
      where: { id: responsibility.id },
      data: { lastPaidAt: new Date(), nextDueAt },
    });
    await scheduleNotifications(tx, {
      userId: input.userId,
      responsibilityId: updated.id,
      title: updated.title,
      dueAt: nextDueAt,
      notificationDays: updated.notificationDays as number[],
    });
    return { responsibility: updated, cancelledNotificationIds };
  });
}

export async function updateResponsibility(input: {
  userId: string;
  responsibilityId: string;
  title: string;
  area: ResponsibilityArea;
  provider?: string | null;
  cadence: ResponsibilityCadence;
  dueDate: string;
  notificationDays: number[];
  timezone: string;
}) {
  return db.$transaction(async (tx) => {
    const current = await tx.responsibility.findFirst({
      where: { id: input.responsibilityId, userId: input.userId, active: true },
    });
    if (!current) return null;
    const dueAt = dateFromKey(input.dueDate, input.timezone);
    const updated = await tx.responsibility.update({
      where: { id: current.id },
      data: {
        title: input.title,
        area: input.area,
        provider: input.provider || null,
        cadence: input.cadence,
        dueDay: Number(input.dueDate.slice(-2)),
        nextDueAt: dueAt,
        notificationDays: input.notificationDays,
      },
    });
    const pending = await tx.notification.findMany({
      where: {
        userId: input.userId,
        status: "QUEUED",
        scheduledAt: { gte: new Date() },
      },
      select: { id: true, metadata: true },
    });
    const cancelledNotificationIds = pending
      .filter(
        (notification) =>
          typeof notification.metadata === "object" &&
          notification.metadata !== null &&
          !Array.isArray(notification.metadata) &&
          notification.metadata.responsibilityId === current.id,
      )
      .map((notification) => notification.id);
    if (cancelledNotificationIds.length) {
      await tx.notification.updateMany({
        where: { id: { in: cancelledNotificationIds }, userId: input.userId },
        data: { status: "CANCELLED" },
      });
    }
    await scheduleNotifications(tx, {
      userId: input.userId,
      responsibilityId: updated.id,
      title: updated.title,
      dueAt,
      notificationDays: input.notificationDays,
    });
    return { responsibility: updated, cancelledNotificationIds };
  });
}

export function responsibilityPayload(
  value: Awaited<ReturnType<typeof db.responsibility.findMany>>[number],
) {
  return {
    ...value,
    amount: value.amount?.toString() ?? null,
    notificationDays: value.notificationDays as number[],
  };
}
