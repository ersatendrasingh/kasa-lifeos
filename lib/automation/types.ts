import { z } from "zod";

export const automationSources = [
  "MANUAL_TEXT",
  "VOICE",
  "CAMERA",
  "DOCUMENT",
  "EMAIL",
  "CALENDAR",
  "SMS",
  "HEALTH",
  "LOCATION",
  "CONTACTS",
  "NOTIFICATION",
  "BROWSER",
  "WHATSAPP",
] as const;

export const automationActionTypes = [
  "ADD_TIMELINE_EVENT",
  "CREATE_TASK",
  "CREATE_REMINDER",
  "CREATE_CALENDAR_EVENT",
  "CREATE_CHECKLIST",
  "LOG_EXPENSE",
  "ADD_SHOPPING_ITEM",
  "ADD_WISH",
  "SAVE_IDEA",
  "UPSERT_LIFE_RECORD",
] as const;

export const lifeRecordTypes = [
  "DOCUMENT",
  "VEHICLE",
  "SUBSCRIPTION",
  "PURCHASE",
  "TRIP",
  "APPOINTMENT",
  "PERSON",
  "HEALTH",
  "CAREER",
  "HOME",
  "LEARNING",
  "OTHER",
] as const;

export const plannedActionSchema = z.object({
  type: z.enum(automationActionTypes),
  title: z.string().trim().min(1).max(180),
  confidence: z.number().min(0).max(1),
  details: z.string().trim().max(1_000).nullable(),
  occurredAt: z.string().datetime().nullable(),
  dueAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  amount: z.number().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
  category: z.string().trim().max(60).nullable(),
  recordType: z.enum(lifeRecordTypes).nullable(),
});

export const automationPlanSchema = z.object({
  summary: z.string().trim().min(1).max(240),
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().trim().max(220).nullable(),
  actions: z.array(plannedActionSchema).min(1).max(8),
});

export type AutomationSource = (typeof automationSources)[number];
export type PlannedAutomationAction = z.infer<typeof plannedActionSchema>;
export type AutomationPlan = z.infer<typeof automationPlanSchema>;
