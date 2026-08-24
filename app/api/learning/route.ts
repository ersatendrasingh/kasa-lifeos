import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  type: z.enum(["COURSE", "BOOK", "SKILL", "PRACTICE", "CERTIFICATION"]),
  provider: z.string().trim().max(80).optional(),
  url: z.string().url().max(1_000).optional().or(z.literal("")),
  description: z.string().trim().max(600).optional(),
  weeklyGoalMinutes: z.number().int().min(15).max(2_400).default(180),
  lessons: z.array(z.string().trim().min(1).max(160)).max(80).default([]),
});
const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("log-session"),
    minutes: z.number().int().min(1).max(720),
    note: z.string().trim().max(600).optional(),
  }),
  z.object({
    action: z.literal("toggle-lesson"),
    lessonId: z.string(),
    completed: z.boolean(),
  }),
  z.object({
    action: z.literal("set-status"),
    status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]),
  }),
]);

async function getUserId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

async function addTimelineEvent({
  userId,
  title,
  summary,
  trackId,
}: {
  userId: string;
  title: string;
  summary: string;
  trackId: string;
}) {
  await db.timelineEvent.create({
    data: {
      userId,
      type: "LEARNING",
      title,
      summary,
      sourceType: "LearningTrack",
      sourceId: trackId,
      metadata: { trackId },
    },
  });
}

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const tracks = await db.learningTrack.findMany({
    where: { userId, status: { not: "ARCHIVED" } },
    include: {
      lessons: { orderBy: { position: "asc" } },
      sessions: {
        where: { studiedAt: { gte: weekStart } },
        orderBy: { studiedAt: "desc" },
      },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  return Response.json({
    tracks: tracks.map((track) => ({
      ...track,
      weeklyMinutes: track.sessions.reduce(
        (sum, session) => sum + session.minutes,
        0,
      ),
    })),
  });
}

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: "Check the learning track details." },
      { status: 400 },
    );
  const value = parsed.data;
  const track = await db.learningTrack.create({
    data: {
      userId,
      title: value.title,
      type: value.type,
      provider: value.provider || null,
      url: value.url || null,
      description: value.description || null,
      weeklyGoalMinutes: value.weeklyGoalMinutes,
      lessons: {
        create: value.lessons.map((title, position) => ({ title, position })),
      },
    },
    include: { lessons: { orderBy: { position: "asc" } }, sessions: true },
  });
  await addTimelineEvent({
    userId,
    trackId: track.id,
    title: `Started learning ${track.title}`,
    summary: `A ${track.type.toLowerCase()} learning track${track.provider ? ` with ${track.provider}` : ""}.`,
  });
  return Response.json(
    { track: { ...track, weeklyMinutes: 0 } },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const trackId = typeof body.trackId === "string" ? body.trackId : "";
  const parsed = patchSchema.safeParse(body);
  if (!trackId || !parsed.success)
    return Response.json(
      { error: "Invalid learning action." },
      { status: 400 },
    );
  const track = await db.learningTrack.findFirst({
    where: { id: trackId, userId },
    select: { id: true, title: true },
  });
  if (!track) return Response.json({ error: "Not found" }, { status: 404 });
  const value = parsed.data;
  if (value.action === "log-session") {
    await db.$transaction([
      db.learningSession.create({
        data: { trackId, minutes: value.minutes, note: value.note || null },
      }),
      db.learningTrack.update({
        where: { id: trackId },
        data: { lastStudiedAt: new Date(), status: "ACTIVE" },
      }),
    ]);
    await addTimelineEvent({
      userId,
      trackId,
      title: `Studied ${track.title}`,
      summary: `${value.minutes} focused minute${value.minutes === 1 ? "" : "s"}${value.note ? ` — ${value.note}` : ""}`,
    });
  } else if (value.action === "toggle-lesson") {
    const lesson = await db.learningLesson.findFirst({
      where: { id: value.lessonId, trackId },
    });
    if (!lesson)
      return Response.json({ error: "Lesson not found" }, { status: 404 });
    await db.learningLesson.update({
      where: { id: lesson.id },
      data: { completedAt: value.completed ? new Date() : null },
    });
    if (value.completed) {
      await addTimelineEvent({
        userId,
        trackId,
        title: `Completed: ${lesson.title}`,
        summary: `Finished a lesson in ${track.title}.`,
      });
    }
  } else {
    await db.learningTrack.update({
      where: { id: trackId },
      data: { status: value.status },
    });
    if (value.status === "COMPLETED") {
      await addTimelineEvent({
        userId,
        trackId,
        title: `Completed ${track.title}`,
        summary: "Learning track completed.",
      });
    }
  }
  return GET(request);
}
