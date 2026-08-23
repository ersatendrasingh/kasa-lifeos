import type { Prisma } from "@/app/generated/prisma/client";

import {
  lifeRecordTypes,
  type PlannedAutomationAction,
} from "@/lib/automation/types";

type Transaction = Prisma.TransactionClient;

const timelineTypes = new Set([
  "FINANCE",
  "HEALTH",
  "CAREER",
  "LEARNING",
  "RELATIONSHIP",
  "VEHICLE",
  "HOME",
  "ACHIEVEMENT",
  "NOTE",
]);

function date(value: string | null, fallback = new Date()) {
  return value ? new Date(value) : fallback;
}

export async function executeAutomationAction(
  tx: Transaction,
  input: {
    actionId: string;
    eventId: string;
    userId: string;
    action: PlannedAutomationAction;
  },
) {
  const { action, eventId, userId } = input;
  let result: Record<string, string>;

  switch (action.type) {
    case "ADD_TIMELINE_EVENT": {
      const category = action.category?.toUpperCase() ?? "NOTE";
      const created = await tx.timelineEvent.create({
        data: {
          userId,
          type: timelineTypes.has(category) ? (category as "NOTE") : "NOTE",
          title: action.title,
          summary: action.details,
          occurredAt: date(action.occurredAt),
          sourceType: "AutomationEvent",
          sourceId: eventId,
          metadata: { automationActionId: input.actionId },
        },
      });
      result = { resourceType: "TimelineEvent", resourceId: created.id };
      break;
    }
    case "CREATE_TASK": {
      const created = await tx.task.create({
        data: {
          userId,
          title: action.title,
          description: action.details,
          dueAt: action.dueAt ? new Date(action.dueAt) : null,
        },
      });
      result = { resourceType: "Task", resourceId: created.id };
      break;
    }
    case "CREATE_REMINDER": {
      const remindAt = date(action.dueAt, new Date(Date.now() + 86_400_000));
      const created = await tx.reminder.create({
        data: {
          userId,
          title: action.title,
          notes: action.details,
          remindAt,
          targetType: "AutomationEvent",
          targetId: eventId,
        },
      });
      await tx.notification.create({
        data: {
          userId,
          reminderId: created.id,
          channel: "IN_APP",
          title: action.title,
          scheduledAt: remindAt,
        },
      });
      result = { resourceType: "Reminder", resourceId: created.id };
      break;
    }
    case "LOG_EXPENSE": {
      const created = await tx.expense.create({
        data: {
          userId,
          title: action.title,
          amount: action.amount,
          currency: action.currency ?? "INR",
          category: action.category,
          occurredAt: date(action.occurredAt),
          isConfirmed: false,
        },
      });
      result = { resourceType: "Expense", resourceId: created.id };
      break;
    }
    case "ADD_SHOPPING_ITEM": {
      const created = await tx.shoppingItem.create({
        data: { userId, title: action.title },
      });
      result = { resourceType: "ShoppingItem", resourceId: created.id };
      break;
    }
    case "ADD_WISH": {
      const created = await tx.wish.create({
        data: {
          userId,
          title: action.title,
          notes: action.details,
          targetAmount: action.amount,
          currency: action.currency ?? "INR",
          targetDate: action.dueAt ? new Date(action.dueAt) : null,
        },
      });
      result = { resourceType: "Wish", resourceId: created.id };
      break;
    }
    case "SAVE_IDEA": {
      const created = await tx.idea.create({
        data: { userId, title: action.title, body: action.details },
      });
      result = { resourceType: "Idea", resourceId: created.id };
      break;
    }
    case "UPSERT_LIFE_RECORD": {
      const recordType =
        action.recordType && lifeRecordTypes.includes(action.recordType)
          ? action.recordType
          : "OTHER";
      const created = await tx.lifeRecord.create({
        data: {
          userId,
          sourceEventId: eventId,
          type: recordType,
          title: action.title,
          occurredAt: action.occurredAt ? new Date(action.occurredAt) : null,
          expiresAt: action.expiresAt ? new Date(action.expiresAt) : null,
          attributes: {
            details: action.details,
            category: action.category,
            amount: action.amount,
            currency: action.currency,
          },
        },
      });
      result = { resourceType: "LifeRecord", resourceId: created.id };
      break;
    }
  }

  await tx.automationAction.update({
    where: { id: input.actionId },
    data: { status: "EXECUTED", result, executedAt: new Date() },
  });
  return result;
}
