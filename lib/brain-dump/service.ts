import type { Prisma } from "@/app/generated/prisma/client";

import { db } from "@/lib/db";
import { classifyBrainDump } from "@/lib/brain-dump/classifier";
import { classifyCaptureWithAI } from "@/lib/brain-dump/ai-classifier";

export async function createCaptureForUser(
  userId: string,
  rawText: string,
  source: "WEB" | "VOICE" = "WEB",
) {
  const classification =
    (await classifyCaptureWithAI(rawText, userId)) ??
    classifyBrainDump(rawText);
  const needsReview = classification.confidence < 0.62;

  return db.$transaction(async (tx) => {
    const capture = await tx.capture.create({
      data: {
        userId,
        rawText,
        normalizedTitle: classification.title,
        category: classification.category,
        status: needsReview ? "NEEDS_REVIEW" : "CLASSIFIED",
        classifier: classification.classifier,
        source,
        confidence: classification.confidence,
        dueAt: classification.dueAt,
        amount: classification.amount,
        currency: classification.currency,
        classifiedAt: new Date(),
        metadata: {
          signals: classification.signals,
          classifierVersion:
            classification.classifier === "AI"
              ? `openai-${process.env.OPENAI_CAPTURE_MODEL || "gpt-4o-mini"}`
              : "rules-v1",
          actionSummary: classification.actionSummary,
        },
      },
    });

    const shared = {
      userId,
      captureId: capture.id,
      title: classification.title,
    };

    switch (classification.category) {
      case "TASK":
        await tx.task.create({
          data: { ...shared, dueAt: classification.dueAt },
        });
        break;
      case "REMINDER": {
        const remindAt =
          classification.dueAt ?? new Date(Date.now() + 86_400_000);
        const reminder = await tx.reminder.create({
          data: { ...shared, remindAt },
        });
        await tx.notification.create({
          data: {
            userId,
            reminderId: reminder.id,
            channel: "IN_APP",
            title: classification.title,
            scheduledAt: remindAt,
          },
        });
        break;
      }
      case "IDEA":
        await tx.idea.create({ data: shared });
        break;
      case "EXPENSE":
        await tx.expense.create({
          data: {
            ...shared,
            amount: classification.amount,
            currency: classification.currency ?? "INR",
          },
        });
        break;
      case "SHOPPING":
        await tx.shoppingItem.create({ data: shared });
        break;
      case "WISH":
        await tx.wish.create({
          data: {
            ...shared,
            targetAmount: classification.amount,
            currency: classification.currency,
          },
        });
        break;
    }

    const timelineMetadata: Prisma.InputJsonValue = {
      category: classification.category,
      confidence: classification.confidence,
    };

    await tx.timelineEvent.create({
      data: {
        userId,
        type: classification.category === "EXPENSE" ? "FINANCE" : "CAPTURED",
        title: classification.title,
        sourceType: "Capture",
        sourceId: capture.id,
        metadata: timelineMetadata,
      },
    });

    return { capture, classification };
  });
}
