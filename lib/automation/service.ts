import type { Prisma } from "@/app/generated/prisma/client";

import { db } from "@/lib/db";
import { executeAutomationAction } from "@/lib/automation/executor";
import { planAutomation } from "@/lib/automation/planner";
import type {
  AutomationSource,
  PlannedAutomationAction,
} from "@/lib/automation/types";

function canAutoExecute(input: {
  action: PlannedAutomationAction;
  manual: boolean;
  mode: "REVIEW_FIRST" | "AUTO_SAFE" | "PAUSED";
  needsClarification: boolean;
}) {
  if (input.mode === "PAUSED" || input.needsClarification) return false;
  if (input.manual) return input.action.confidence >= 0.62;
  return input.mode === "AUTO_SAFE" && input.action.confidence >= 0.82;
}

export async function ingestAutomationEvent(input: {
  userId: string;
  source: AutomationSource;
  rawText: string;
  contentType?: string;
  sourceExternalId?: string;
  connectionId?: string;
  occurredAt?: Date;
  metadata?: Prisma.InputJsonValue;
}) {
  const existing = input.sourceExternalId
    ? await db.automationEvent.findUnique({
        where: {
          userId_source_sourceExternalId: {
            userId: input.userId,
            source: input.source,
            sourceExternalId: input.sourceExternalId,
          },
        },
        include: { actions: true },
      })
    : null;
  if (existing) return existing;

  const profile = await db.userProfile.findUnique({
    where: { userId: input.userId },
    select: { timezone: true },
  });
  const policy = await db.automationPolicy.findUnique({
    where: { userId_source: { userId: input.userId, source: input.source } },
    select: { mode: true },
  });
  const occurredAt = input.occurredAt ?? new Date();
  const event = await db.automationEvent.create({
    data: {
      userId: input.userId,
      connectionId: input.connectionId,
      source: input.source,
      sourceExternalId: input.sourceExternalId,
      rawText: input.rawText,
      contentType: input.contentType ?? "text/plain",
      occurredAt,
      metadata: input.metadata,
    },
  });

  try {
    const { plan, planner } = await planAutomation({
      rawText: input.rawText,
      source: input.source,
      userId: input.userId,
      timezone: profile?.timezone ?? "Asia/Kolkata",
      occurredAt,
    });
    const manual = input.source === "MANUAL_TEXT" || input.source === "VOICE";
    const mode = policy?.mode ?? "AUTO_SAFE";

    return await db.$transaction(async (tx) => {
      let reviewCount = 0;
      for (const action of plan.actions) {
        const execute = canAutoExecute({
          action,
          manual,
          mode,
          needsClarification: plan.needsClarification,
        });
        const row = await tx.automationAction.create({
          data: {
            userId: input.userId,
            eventId: event.id,
            type: action.type,
            status: execute ? "PROPOSED" : "NEEDS_REVIEW",
            title: action.title,
            confidence: action.confidence,
            requiresReview: !execute,
            payload: action,
          },
        });
        if (execute) {
          await executeAutomationAction(tx, {
            actionId: row.id,
            eventId: event.id,
            userId: input.userId,
            action,
          });
        } else {
          reviewCount += 1;
        }
      }

      return tx.automationEvent.update({
        where: { id: event.id },
        data: {
          summary: plan.summary,
          confidence: plan.confidence,
          status: reviewCount ? "NEEDS_REVIEW" : "ACTIONED",
          processedAt: new Date(),
          metadata: {
            ...(typeof input.metadata === "object" && input.metadata
              ? input.metadata
              : {}),
            planner,
            clarificationQuestion: plan.clarificationQuestion,
          },
        },
        include: { actions: { orderBy: { createdAt: "asc" } } },
      });
    });
  } catch (error) {
    await db.automationEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        processedAt: new Date(),
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      },
    });
    throw error;
  }
}
