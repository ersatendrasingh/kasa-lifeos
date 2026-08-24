import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Holidays from "date-holidays";
import { getDatesForYear } from "@aryanjsx/indian-festivals";
import { z } from "zod";

const deviceBirthdaySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  birthdays: z
    .array(
      z.object({
        externalId: z.string().min(1).max(500),
        title: z.string().trim().min(1).max(200),
        date: z.string().datetime(),
      }),
    )
    .max(500),
});
const manualEventSchema = z.object({
  action: z.literal("manual-event"),
  title: z.string().trim().min(2).max(160),
  kind: z.enum(["BIRTHDAY", "PLAN", "MEETING", "OTHER"]),
  startsAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(1_440).default(60),
  allDay: z.boolean().default(false),
  notes: z.string().trim().max(1_000).optional(),
  meetingUrl: z.string().url().max(1_000).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
});

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

  // The festival dataset is bundled on the server, not fetched from a fragile
  // public endpoint. It covers 65+ Indian festivals (including lunar dates)
  // and the national-holiday engine fills in fixed public holidays.
  const year = from.getUTCFullYear();
  const festivalDates = getDatesForYear(year).map((festival) => ({
    date: festival.date,
    name: festival.name,
    detail: `${festival.religion} festival`,
  }));
  const publicHolidays = new Holidays("IN")
    .getHolidays(year)
    .map((holiday) => ({
      date: holiday.date.slice(0, 10),
      name: holiday.name,
      detail: "Indian public holiday",
    }));
  const holidays = [...festivalDates, ...publicHolidays].filter(
    (holiday, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.date === holiday.date && candidate.name === holiday.name,
      ) === index,
  );

  const [calendarEvents, tasks, documents, timeline] = await Promise.all([
    db.calendarEvent.findMany({
      where: { userId, startsAt: { gte: from, lt: to } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        sourceEventId: true,
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
      where: {
        userId,
        hiddenAt: null,
        sourceType: { not: "MONEY_LEDGER" },
        occurredAt: { gte: from, lt: to },
      },
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
      type: event.sourceEventId?.startsWith("device-birthday:")
        ? "BIRTHDAY"
        : event.sourceEventId?.endsWith(":BIRTHDAY")
          ? "BIRTHDAY"
          : event.sourceEventId?.startsWith("c") &&
              event.title.startsWith("Money ")
            ? "MONEY"
            : "EVENT",
      title: event.title,
      detail: event.notes,
      meetingUrl:
        event.notes?.match(/\[meeting-url:(https?:\/\/[^\]]+)\]/)?.[1] ?? null,
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
    ...holidays
      .filter((holiday) => {
        const date = new Date(`${holiday.date}T12:00:00.000Z`);
        return date >= from && date < to;
      })
      .map((holiday) => ({
        id: `festival:IN:${holiday.date}:${holiday.name}`,
        type: "FESTIVAL" as const,
        title: holiday.name,
        detail: holiday.detail,
        date: new Date(`${holiday.date}T12:00:00.000Z`),
        allDay: true,
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

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const manual = manualEventSchema.safeParse(body);
  if (manual.success) {
    const value = manual.data;
    const first = new Date(value.startsAt);
    const seriesId = crypto.randomUUID();
    const occurrences: Date[] = [];
    if (value.weekdays.length) {
      const daySet = new Set(value.weekdays);
      const cursor = new Date(first);
      const end = new Date(first);
      end.setDate(end.getDate() + 365);
      while (cursor <= end) {
        if (daySet.has(cursor.getDay()) && cursor >= first) {
          occurrences.push(new Date(cursor));
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      occurrences.push(first);
    }
    const notes = [
      value.notes,
      value.meetingUrl ? `[meeting-url:${value.meetingUrl}]` : undefined,
      value.weekdays.length ? "Repeats weekly" : undefined,
    ]
      .filter(Boolean)
      .join("\n");
    const created = await db.$transaction(async (tx) => {
      const events = await Promise.all(
        occurrences.map((startsAt) =>
          tx.calendarEvent.create({
            data: {
              userId: session.user.id,
              sourceEventId: `manual:${seriesId}:${value.kind}`,
              title: value.title,
              notes: notes || null,
              startsAt,
              endsAt: value.allDay
                ? null
                : new Date(startsAt.getTime() + value.durationMinutes * 60_000),
              allDay: value.allDay,
            },
            select: { id: true, startsAt: true },
          }),
        ),
      );
      await tx.notification.createMany({
        data: events
          .map((event) => ({
            userId: session.user.id,
            channel: "PUSH" as const,
            title: `In 30 min: ${value.title}`,
            body: value.meetingUrl
              ? "Your meeting link is ready in KASA."
              : "Your calendar plan is coming up.",
            scheduledAt: new Date(event.startsAt.getTime() - 30 * 60_000),
            metadata: {
              category: "calendar",
              calendarEventId: event.id,
              url: "/calendar",
            },
          }))
          .filter((notification) => notification.scheduledAt > new Date()),
      });
      return events[0];
    });
    return Response.json(
      { event: created, occurrences: occurrences.length },
      { status: 201 },
    );
  }
  const parsed = deviceBirthdaySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid birthday calendar data" },
      { status: 400 },
    );
  }
  const [year, month] = parsed.data.month.split("-").map(Number);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  await db.$transaction([
    db.calendarEvent.deleteMany({
      where: {
        userId: session.user.id,
        sourceEventId: { startsWith: "device-birthday:" },
        startsAt: { gte: from, lt: to },
      },
    }),
    db.calendarEvent.createMany({
      data: parsed.data.birthdays.map((birthday) => ({
        userId: session.user.id,
        sourceEventId: `device-birthday:${birthday.externalId}`,
        title: birthday.title,
        notes: "Birthday synced from the device calendar.",
        startsAt: new Date(birthday.date),
        allDay: true,
      })),
    }),
  ]);
  return Response.json({ success: true, saved: parsed.data.birthdays.length });
}
