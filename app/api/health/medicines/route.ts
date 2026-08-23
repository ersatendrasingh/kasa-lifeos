import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM time");
const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  dose: z.string().trim().max(80).optional(),
  times: z.array(time).min(1).max(4),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
});

async function userId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

function scheduledAt(day: Date, timeValue: string) {
  const [hour, minute] = timeValue.split(":").map(Number);
  const result = new Date(day);
  result.setHours(hour, minute, 0, 0);
  return result;
}

async function queueUpcomingDoses(input: {
  userId: string;
  planId: string;
  name: string;
  dose: string | null;
  times: string[];
  startDate: Date;
  endDate: Date | null;
}) {
  const now = new Date();
  const lastDay = input.endDate && input.endDate < new Date(now.getTime() + 30 * 86_400_000)
    ? input.endDate
    : new Date(now.getTime() + 30 * 86_400_000);
  const start = input.startDate > now ? input.startDate : now;
  const existing = await db.notification.findMany({
    where: {
      userId: input.userId,
      status: "QUEUED",
      scheduledAt: { gt: now, lte: lastDay },
    },
    select: { scheduledAt: true, metadata: true },
  });
  const existingKeys = new Set(
    existing
      .filter(
        (item) =>
          typeof item.metadata === "object" &&
          item.metadata !== null &&
          !Array.isArray(item.metadata) &&
          item.metadata.medicinePlanId === input.planId,
      )
      .map((item) => item.scheduledAt.toISOString()),
  );
  const notifications = [];
  for (let day = new Date(start.getFullYear(), start.getMonth(), start.getDate()); day <= lastDay; day.setDate(day.getDate() + 1)) {
    for (const timeValue of input.times) {
      const at = scheduledAt(day, timeValue);
      if (at > now && !existingKeys.has(at.toISOString())) {
        notifications.push({
          userId: input.userId,
          channel: "IN_APP" as const,
          title: `Time for ${input.name}`,
          body: input.dose ? `${input.dose} · Mark it complete in Health Hub.` : "Mark it complete in Health Hub.",
          scheduledAt: at,
          metadata: { kind: "MEDICINE", medicinePlanId: input.planId, time: timeValue },
        });
      }
    }
  }
  if (notifications.length) await db.notification.createMany({ data: notifications });
}

export async function GET(request: Request) {
  const id = await userId(request);
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const plans = await db.medicinePlan.findMany({
    where: { userId: id },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });
  await Promise.all(
    plans
      .filter((plan) => plan.active)
      .map((plan) =>
        queueUpcomingDoses({
          userId: id,
          planId: plan.id,
          name: plan.name,
          dose: plan.dose,
          times: plan.times as string[],
          startDate: plan.startDate,
          endDate: plan.endDate,
        }),
      ),
  );
  return Response.json({ plans });
}

export async function POST(request: Request) {
  const id = await userId(request);
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = planSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Check the medicine schedule." }, { status: 400 });
  const { name, dose, times, startDate, endDate } = parsed.data;
  if (endDate && endDate < startDate) return Response.json({ error: "End date must be after the start date." }, { status: 400 });
  const plan = await db.medicinePlan.create({
    data: { userId: id, name, dose: dose || null, times: [...new Set(times)].sort(), startDate, endDate: endDate ?? null },
  });
  await queueUpcomingDoses({ userId: id, planId: plan.id, name: plan.name, dose: plan.dose, times: plan.times as string[], startDate: plan.startDate, endDate: plan.endDate });
  return Response.json({ plan }, { status: 201 });
}
