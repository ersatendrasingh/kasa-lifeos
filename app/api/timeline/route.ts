import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["hide", "restore"]),
});

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const requestedYear = new URL(request.url).searchParams.get("year");
  const year = requestedYear ? Number(requestedYear) : null;
  const validYear =
    year && Number.isInteger(year) && year >= 1900 && year <= 2200;
  const occurredAt = validYear
    ? {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      }
    : undefined;
  const [events, historyDates] = await Promise.all([
    db.timelineEvent.findMany({
      where: { userId: session.user.id, hiddenAt: null, occurredAt },
      orderBy: { occurredAt: "desc" },
      take: 250,
      select: {
        id: true,
        type: true,
        title: true,
        summary: true,
        occurredAt: true,
        sourceType: true,
        metadata: true,
      },
    }),
    db.timelineEvent.findMany({
      where: { userId: session.user.id, hiddenAt: null },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true },
    }),
  ]);
  const years = [
    ...new Set(historyDates.map(({ occurredAt }) => occurredAt.getFullYear())),
  ];
  return Response.json({ events, years });
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid timeline action" }, { status: 400 });
  }
  const result = await db.timelineEvent.updateMany({
    where: { id: parsed.data.id, userId: session.user.id },
    data: { hiddenAt: parsed.data.action === "hide" ? new Date() : null },
  });
  if (!result.count) {
    return Response.json(
      { error: "Timeline moment not found" },
      { status: 404 },
    );
  }
  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json(
      { error: "Timeline moment is required" },
      { status: 400 },
    );
  }
  const result = await db.timelineEvent.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (!result.count) {
    return Response.json(
      { error: "Timeline moment not found" },
      { status: 404 },
    );
  }
  return Response.json({ success: true });
}
