import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const startOfMonth = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requested = new URL(request.url).searchParams.get("month");
  const selected = requested
    ? new Date(`${requested}T00:00:00.000Z`)
    : new Date();
  if (Number.isNaN(selected.getTime())) {
    return Response.json({ error: "Invalid calendar month" }, { status: 400 });
  }
  const from = startOfMonth(selected);
  const to = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1),
  );
  const userId = session.user.id;

  const [calendarEvents, tasks, documents, timeline] = await Promise.all([
    db.calendarEvent.findMany({
      where: { userId, startsAt: { gte: from, lt: to } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        title: true,
        notes: true,
        startsAt: true,
        allDay: true,
        budgetAmount: true,
        currency: true,
      },
    }),
    db.task.findMany({
      where: {
        userId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueAt: { gte: from, lt: to },
      },
      orderBy: { dueAt: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        dueAt: true,
        priority: true,
      },
    }),
    db.document.findMany({
      where: { userId, expiresAt: { gte: from, lt: to } },
      orderBy: { expiresAt: "asc" },
      select: { id: true, title: true, categorySlug: true, expiresAt: true },
    }),
    db.timelineEvent.findMany({
      where: { userId, hiddenAt: null, occurredAt: { gte: from, lt: to } },
      orderBy: { occurredAt: "asc" },
      select: {
        id: true,
        title: true,
        summary: true,
        occurredAt: true,
        type: true,
      },
    }),
  ]);

  const items = [
    ...calendarEvents.map((event) => ({
      id: `event:${event.id}`,
      type: "EVENT",
      title: event.title,
      detail: event.notes,
      date: event.startsAt,
      allDay: event.allDay,
      budgetAmount: event.budgetAmount?.toString() ?? null,
      currency: event.currency,
    })),
    ...tasks.map((task) => ({
      id: `task:${task.id}`,
      type: "TASK",
      title: task.title,
      detail: task.description,
      date: task.dueAt!,
      allDay: true,
      priority: task.priority,
    })),
    ...documents.map((document) => ({
      id: `document:${document.id}`,
      type: "EXPIRY",
      title: `${document.title} expires`,
      detail: document.categorySlug,
      date: document.expiresAt!,
      allDay: true,
    })),
    ...timeline.map((event) => ({
      id: `timeline:${event.id}`,
      type: "MOMENT",
      title: event.title,
      detail: event.summary,
      date: event.occurredAt,
      allDay: false,
      category: event.type,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const checklists = await db.checklist.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { items: { orderBy: { position: "asc" } } },
  });
  return Response.json({ month: from.toISOString(), items, checklists });
}
