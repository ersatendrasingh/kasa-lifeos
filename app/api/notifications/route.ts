import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const actionSchema = z.object({ action: z.literal("read-all") });

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const visibleNow = { lte: new Date() };
  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      // A scheduled renewal is useful only when its time has arrived. Keeping
      // future rows out of the inbox prevents years-away expiry dates from
      // masquerading as alerts that need attention today.
      where: {
        userId: session.user.id,
        status: { not: "CANCELLED" },
        scheduledAt: visibleNow,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        body: true,
        channel: true,
        status: true,
        scheduledAt: true,
        sentAt: true,
        readAt: true,
        metadata: true,
        createdAt: true,
      },
    }),
    db.notification.count({
      where: {
        userId: session.user.id,
        readAt: null,
        status: { not: "CANCELLED" },
        scheduledAt: visibleNow,
      },
    }),
  ]);
  return Response.json({ notifications, unreadCount });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const notification = await db.notification.create({
    data: {
      userId: session.user.id,
      channel: "IN_APP",
      title: "KASA is ready ✦",
      body: "Your smart reminders and custom KASA tone are working.",
      scheduledAt: new Date(Date.now() + 3_000),
      metadata: { category: "REMINDER", kind: "TEST" },
    },
  });
  return Response.json({ notification }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid notification action" },
      { status: 400 },
    );
  }
  await db.notification.updateMany({
    where: {
      userId: session.user.id,
      readAt: null,
      status: { not: "CANCELLED" },
    },
    data: { readAt: new Date(), status: "READ" },
  });
  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scope = new URL(request.url).searchParams.get("scope");
  await db.notification.deleteMany({
    where: {
      userId: session.user.id,
      ...(scope === "all" ? {} : { readAt: { not: null } }),
    },
  });
  return Response.json({ success: true });
}
