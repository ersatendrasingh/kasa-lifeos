import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const updateSchema = z.object({ read: z.boolean() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid notification state" },
      { status: 400 },
    );
  }
  const { id } = await context.params;
  const current = await db.notification.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, status: true },
  });
  if (!current) return Response.json({ error: "Not found" }, { status: 404 });
  const notification = await db.notification.update({
    where: { id },
    data: {
      readAt: parsed.data.read ? new Date() : null,
      status: parsed.data.read
        ? "READ"
        : current.status === "READ"
          ? "SENT"
          : current.status,
    },
  });
  return Response.json({ notification });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const deleted = await db.notification.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (!deleted.count) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ success: true });
}
