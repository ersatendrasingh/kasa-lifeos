import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const syncSchema = z.object({ ids: z.array(z.string().min(1)).max(100) });

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const notifications = await db.notification.findMany({
    where: { userId: session.user.id, status: "QUEUED" },
    orderBy: { scheduledAt: "asc" },
    take: 100,
    select: { id: true, title: true, body: true, scheduledAt: true },
  });
  return Response.json({ notifications });
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = syncSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid sync receipt" }, { status: 400 });
  }
  await db.notification.updateMany({
    where: {
      id: { in: parsed.data.ids },
      userId: session.user.id,
      status: "QUEUED",
    },
    data: { status: "SENT", sentAt: new Date() },
  });
  return Response.json({ success: true });
}
