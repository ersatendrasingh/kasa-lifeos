import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createResponsibility,
  payResponsibility,
  responsibilityAreas,
  responsibilityCadences,
  responsibilityPayload,
  updateResponsibility,
} from "@/lib/responsibilities/service";

const createSchema = z.object({
  title: z.string().trim().min(2).max(100),
  area: z.enum(responsibilityAreas),
  provider: z.string().trim().max(100).nullable().optional(),
  cadence: z.enum(responsibilityCadences),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notificationDays: z.array(z.number().int().min(1).max(365)).min(1).max(4),
  amount: z.number().positive().max(10_000_000).nullable().optional(),
});
const paySchema = z.object({
  action: z.literal("paid"),
  id: z.string().min(1),
});
const updateSchema = createSchema.extend({
  action: z.literal("update"),
  id: z.string().min(1),
});

async function currentUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) return null;
  const profile = await db.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { timezone: true },
  });
  return {
    userId: session.user.id,
    timezone: profile?.timezone ?? "Asia/Kolkata",
  };
}

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const responsibilities = await db.responsibility.findMany({
    where: { userId: user.userId, active: true },
    orderBy: { nextDueAt: "asc" },
  });
  return Response.json({
    responsibilities: responsibilities.map(responsibilityPayload),
  });
}

export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Please complete the responsibility details." },
      { status: 400 },
    );
  }
  const responsibility = await createResponsibility({
    userId: user.userId,
    timezone: user.timezone,
    ...parsed.data,
  });
  return Response.json(
    { responsibility: responsibilityPayload(responsibility) },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const user = await currentUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const paid = paySchema.safeParse(body);
  const update = updateSchema.safeParse(body);
  if (!paid.success && !update.success) {
    return Response.json(
      { error: "Invalid responsibility action" },
      { status: 400 },
    );
  }
  if (paid.success) {
    const result = await payResponsibility({
      userId: user.userId,
      responsibilityId: paid.data.id,
      timezone: user.timezone,
    });
    if (!result) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({
      responsibility: responsibilityPayload(result.responsibility),
      cancelledNotificationIds: result.cancelledNotificationIds,
    });
  }
  const data = update.data!;
  const result = await updateResponsibility({
    userId: user.userId,
    timezone: user.timezone,
    ...data,
    responsibilityId: data.id,
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({
    responsibility: responsibilityPayload(result.responsibility),
    cancelledNotificationIds: result.cancelledNotificationIds,
  });
}
