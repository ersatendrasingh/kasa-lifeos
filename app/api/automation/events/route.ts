import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await db.automationEvent.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      source: true,
      rawText: true,
      summary: true,
      status: true,
      confidence: true,
      occurredAt: true,
      createdAt: true,
      actions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          title: true,
          status: true,
          confidence: true,
          requiresReview: true,
        },
      },
    },
  });

  return Response.json({ events });
}

/**
 * Removing a capture must also remove the things KASA created from it. Keeping
 * an incorrect reminder or calendar plan after its source is deleted is worse
 * than keeping the capture itself.
 */
export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id)
    return Response.json({ error: "Capture is required" }, { status: 400 });
  const event = await db.automationEvent.findFirst({
    where: { id, userId: session.user.id },
    include: { actions: { select: { type: true, result: true } } },
  });
  if (!event)
    return Response.json({ error: "Capture not found" }, { status: 404 });

  await db.$transaction(async (tx) => {
    for (const action of event.actions) {
      const result = action.result;
      const resourceId =
        result &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        "resourceId" in result
          ? String(result.resourceId)
          : null;
      if (!resourceId) continue;
      const owned = { id: resourceId, userId: session.user.id };
      switch (action.type) {
        case "CREATE_TASK":
          await tx.task.deleteMany({ where: owned });
          break;
        case "CREATE_REMINDER":
          await tx.notification.deleteMany({
            where: { reminderId: resourceId, userId: session.user.id },
          });
          await tx.reminder.deleteMany({ where: owned });
          break;
        case "CREATE_CALENDAR_EVENT":
          await tx.calendarEvent.deleteMany({ where: owned });
          break;
        case "CREATE_CHECKLIST":
          await tx.checklist.deleteMany({ where: owned });
          break;
        case "LOG_EXPENSE":
          await tx.expense.deleteMany({ where: owned });
          break;
        case "ADD_SHOPPING_ITEM":
          await tx.shoppingItem.deleteMany({ where: owned });
          break;
        case "ADD_WISH":
          await tx.wish.deleteMany({ where: owned });
          break;
        case "SAVE_IDEA":
          await tx.idea.deleteMany({ where: owned });
          break;
        case "UPSERT_LIFE_RECORD":
          await tx.lifeRecord.deleteMany({ where: owned });
          break;
      }
    }
    await tx.timelineEvent.deleteMany({
      where: {
        userId: session.user.id,
        sourceType: "AutomationEvent",
        sourceId: event.id,
      },
    });
    await tx.calendarEvent.deleteMany({
      where: { userId: session.user.id, sourceEventId: event.id },
    });
    await tx.lifeRecord.deleteMany({
      where: { userId: session.user.id, sourceEventId: event.id },
    });
    await tx.automationEvent.delete({ where: { id: event.id } });
  });
  return Response.json({ success: true });
}
