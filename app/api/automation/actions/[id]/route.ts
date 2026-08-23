import { z } from "zod";

import { auth } from "@/lib/auth";
import { executeAutomationAction } from "@/lib/automation/executor";
import { plannedActionSchema } from "@/lib/automation/types";
import { db } from "@/lib/db";

const decisionSchema = z.object({ decision: z.enum(["approve", "reject"]) });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = decisionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid decision" }, { status: 400 });
  }
  const { id } = await context.params;
  const action = await db.automationAction.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!action) return Response.json({ error: "Not found" }, { status: 404 });
  if (action.status !== "NEEDS_REVIEW" && action.status !== "PROPOSED") {
    return Response.json(
      { error: "This action has already been decided" },
      { status: 409 },
    );
  }

  if (parsed.data.decision === "reject") {
    const rejected = await db.automationAction.update({
      where: { id: action.id },
      data: { status: "REJECTED", requiresReview: false },
    });
    return Response.json({ action: rejected });
  }

  const payload = plannedActionSchema.safeParse(action.payload);
  if (!payload.success) {
    return Response.json(
      { error: "Stored action is invalid" },
      { status: 422 },
    );
  }
  await db.$transaction(async (tx) => {
    await executeAutomationAction(tx, {
      actionId: action.id,
      eventId: action.eventId,
      userId: session.user.id,
      action: payload.data,
    });
    const remaining = await tx.automationAction.count({
      where: { eventId: action.eventId, status: "NEEDS_REVIEW" },
    });
    if (remaining === 0) {
      await tx.automationEvent.update({
        where: { id: action.eventId },
        data: { status: "ACTIONED" },
      });
    }
  });

  return Response.json({ success: true });
}
