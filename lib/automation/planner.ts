import { createHash } from "node:crypto";

import { classifyBrainDump } from "@/lib/brain-dump/classifier";
import {
  automationActionTypes,
  automationPlanSchema,
  lifeRecordTypes,
  type AutomationPlan,
  type AutomationSource,
  type PlannedAutomationAction,
} from "@/lib/automation/types";

const responseFormat = {
  type: "json_schema",
  name: "kasa_automation_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      needsClarification: { type: "boolean" },
      clarificationQuestion: { type: ["string", "null"] },
      actions: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: automationActionTypes },
            title: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            details: { type: ["string", "null"] },
            occurredAt: { type: ["string", "null"], format: "date-time" },
            dueAt: { type: ["string", "null"], format: "date-time" },
            expiresAt: { type: ["string", "null"], format: "date-time" },
            amount: { type: ["number", "null"], minimum: 0 },
            currency: { type: ["string", "null"] },
            category: { type: ["string", "null"] },
            recordType: {
              type: ["string", "null"],
              enum: [...lifeRecordTypes, null],
            },
          },
          required: [
            "type",
            "title",
            "confidence",
            "details",
            "occurredAt",
            "dueAt",
            "expiresAt",
            "amount",
            "currency",
            "category",
            "recordType",
          ],
        },
      },
    },
    required: [
      "summary",
      "confidence",
      "needsClarification",
      "clarificationQuestion",
      "actions",
    ],
  },
} as const;

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

function outputText(payload: OpenAIResponse) {
  if (payload.output_text) return payload.output_text;
  for (const output of payload.output ?? []) {
    const text = output.content?.find(
      (content) => content.type === "output_text",
    )?.text;
    if (text) return text;
  }
  return null;
}

function fallbackPlan(rawText: string): AutomationPlan {
  const classification = classifyBrainDump(rawText);
  const typeByCategory = {
    TASK: "CREATE_TASK",
    REMINDER: "CREATE_REMINDER",
    IDEA: "SAVE_IDEA",
    EXPENSE: "LOG_EXPENSE",
    SHOPPING: "ADD_SHOPPING_ITEM",
    WISH: "ADD_WISH",
  } as const;
  const action: PlannedAutomationAction = {
    type: typeByCategory[classification.category],
    title: classification.title,
    confidence: classification.confidence,
    details: null,
    occurredAt: new Date().toISOString(),
    dueAt: classification.dueAt?.toISOString() ?? null,
    expiresAt: null,
    amount: classification.amount ? Number(classification.amount) : null,
    currency: classification.currency ?? null,
    category: classification.category,
    recordType: null,
  };

  return {
    summary: classification.actionSummary,
    confidence: classification.confidence,
    needsClarification: classification.confidence < 0.62,
    clarificationQuestion:
      classification.confidence < 0.62
        ? "I understood the note, but what should KASA do with it?"
        : null,
    actions: [action],
  };
}

function inDays(from: Date, days: number) {
  const value = new Date(from);
  value.setDate(value.getDate() + days);
  value.setHours(9, 0, 0, 0);
  return value.toISOString();
}

function timezoneParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(value);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function zonedDateTime(
  value: Date,
  timezone: string,
  hour: number,
  minute: number,
  addDays = 0,
) {
  const current = timezoneParts(value, timezone);
  const target = new Date(
    Date.UTC(current.year, current.month - 1, current.day + addDays),
  );
  const guess = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
    hour,
    minute,
  );
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(guess));
  const part = (type: string) =>
    Number(formatted.find((item) => item.type === type)?.value);
  const timezoneOffset =
    Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
    ) - guess;
  return new Date(guess - timezoneOffset);
}

function meetingDate(rawText: string, occurredAt: Date, timezone: string) {
  const time = rawText.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  let hour = Number(time?.[1] ?? 9);
  const minute = Number(time?.[2] ?? 0);
  if (time?.[3]?.toLowerCase() === "pm" && hour < 12) hour += 12;
  if (time?.[3]?.toLowerCase() === "am" && hour === 12) hour = 0;
  return zonedDateTime(occurredAt, timezone, hour, minute, 1);
}

function lifecyclePlan(
  rawText: string,
  occurredAt: Date,
  timezone: string,
): AutomationPlan | null {
  const text = rawText.toLowerCase();
  const action = (input: Omit<PlannedAutomationAction, "confidence">) => ({
    ...input,
    confidence: 0.96,
  });

  const tripMatch = text.match(/\b(goa|travel|trip|holiday|vacation)\b/);
  const decemberMatch = /\bdec(?:ember)?\b/.test(text);
  if (tripMatch && decemberMatch) {
    const year =
      occurredAt.getMonth() <= 11
        ? occurredAt.getFullYear()
        : occurredAt.getFullYear() + 1;
    const tripStart = new Date(year, 11, 1, 9, 0, 0);
    const hotelReminder = new Date(year, 9, 15, 9, 0, 0);
    const weatherReminder = new Date(year, 10, 24, 9, 0, 0);
    return {
      summary:
        "Your Goa plan is ready: a December calendar plan, packing checklist, budget space, and timely hotel plus weather reminders.",
      confidence: 0.96,
      needsClarification: false,
      clarificationQuestion: null,
      actions: [
        action({
          type: "CREATE_TASK",
          title: "Plan Goa trip",
          details:
            "Choose travel dates, confirm transport and set a comfortable trip budget.",
          occurredAt: occurredAt.toISOString(),
          dueAt: tripStart.toISOString(),
          expiresAt: null,
          amount: null,
          currency: "INR",
          category: "TRAVEL",
          recordType: null,
        }),
        action({
          type: "CREATE_CALENDAR_EVENT",
          title: "Goa trip · December plan",
          details:
            "A flexible December trip placeholder. Update the exact travel dates when they are decided.",
          occurredAt: null,
          dueAt: tripStart.toISOString(),
          expiresAt: null,
          amount: null,
          currency: "INR",
          category: "TRAVEL",
          recordType: null,
        }),
        action({
          type: "CREATE_CHECKLIST",
          title: "Goa packing checklist",
          details:
            "Book travel\nReserve hotel\nPack ID and tickets\nPack swimwear and sunscreen\nCarry medicines and chargers",
          occurredAt: null,
          dueAt: tripStart.toISOString(),
          expiresAt: null,
          amount: null,
          currency: null,
          category: "TRAVEL",
          recordType: null,
        }),
        action({
          type: "UPSERT_LIFE_RECORD",
          title: "Goa trip budget",
          details:
            "Budget space for travel, stay, food and activities. Add your target amount when ready.",
          occurredAt: occurredAt.toISOString(),
          dueAt: null,
          expiresAt: null,
          amount: null,
          currency: "INR",
          category: "TRAVEL_BUDGET",
          recordType: "TRIP",
        }),
        action({
          type: "CREATE_REMINDER",
          title: "Book your Goa stay",
          details: "Reserve a hotel before December availability gets tighter.",
          occurredAt: null,
          dueAt: hotelReminder.toISOString(),
          expiresAt: null,
          amount: null,
          currency: null,
          category: "TRAVEL",
          recordType: null,
        }),
        action({
          type: "CREATE_REMINDER",
          title: "Check Goa weather and pack",
          details:
            "Review the forecast and finish packing one week before the trip plan.",
          occurredAt: null,
          dueAt: weatherReminder.toISOString(),
          expiresAt: null,
          amount: null,
          currency: null,
          category: "TRAVEL",
          recordType: null,
        }),
      ],
    };
  }

  if (/\bmeeting\b/.test(text) && /\b(tomorrow|kal)\b/.test(text)) {
    const dueAt = meetingDate(text, occurredAt, timezone);
    const reminderAt = new Date(dueAt.getTime() - 30 * 60 * 1_000);
    return {
      summary: "Your meeting has been added to your calendar.",
      confidence: 0.96,
      needsClarification: false,
      clarificationQuestion: null,
      actions: [
        action({
          type: "CREATE_CALENDAR_EVENT",
          title: "Meeting",
          details: "",
          occurredAt: null,
          dueAt: dueAt.toISOString(),
          expiresAt: null,
          amount: null,
          currency: null,
          category: "MEETING",
          recordType: null,
        }),
        action({
          type: "CREATE_REMINDER",
          title: "Meeting in 30 minutes",
          details: "A calm heads-up before your meeting.",
          occurredAt: null,
          dueAt: reminderAt.toISOString(),
          expiresAt: null,
          amount: null,
          currency: null,
          category: "WORK",
          recordType: null,
        }),
      ],
    };
  }

  if (/\b(bike|motorcycle|scooter)\b.*\b(kharid|bought|purchas)/i.test(text)) {
    return {
      summary:
        "Vehicle created, your timeline updated, and service plus insurance reminders are ready.",
      confidence: 0.96,
      needsClarification: false,
      clarificationQuestion: null,
      actions: [
        action({
          type: "UPSERT_LIFE_RECORD",
          title: "New bike",
          details: "Added from Quick Capture",
          occurredAt: occurredAt.toISOString(),
          dueAt: null,
          expiresAt: null,
          amount: null,
          currency: null,
          category: "VEHICLE",
          recordType: "VEHICLE",
        }),
        action({
          type: "ADD_TIMELINE_EVENT",
          title: "Bought a bike",
          details: "A new vehicle was added to your life timeline.",
          occurredAt: occurredAt.toISOString(),
          dueAt: null,
          expiresAt: null,
          amount: null,
          currency: null,
          category: "VEHICLE",
          recordType: null,
        }),
        action({
          type: "CREATE_REMINDER",
          title: "First bike service",
          details:
            "Your first-service reminder, scheduled 90 days after purchase.",
          occurredAt: null,
          dueAt: inDays(occurredAt, 90),
          expiresAt: null,
          amount: null,
          currency: null,
          category: "VEHICLE",
          recordType: null,
        }),
        action({
          type: "CREATE_REMINDER",
          title: "Renew bike insurance",
          details:
            "Insurance renewal reminder, one month before the expected annual renewal.",
          occurredAt: null,
          dueAt: inDays(occurredAt, 335),
          expiresAt: null,
          amount: null,
          currency: null,
          category: "VEHICLE",
          recordType: null,
        }),
      ],
    };
  }

  if (/\bpassport\b.*\b(renew|renewal|extend)/i.test(text)) {
    return {
      summary:
        "Passport renewal is now on your task list, with a follow-up reminder and timeline entry.",
      confidence: 0.95,
      needsClarification: false,
      clarificationQuestion: null,
      actions: [
        action({
          type: "CREATE_TASK",
          title: "Renew passport",
          details:
            "Start the passport renewal application and collect the required documents.",
          occurredAt: occurredAt.toISOString(),
          dueAt: null,
          expiresAt: null,
          amount: null,
          currency: null,
          category: "DOCUMENT",
          recordType: null,
        }),
        action({
          type: "CREATE_REMINDER",
          title: "Start passport renewal",
          details: "A next-day nudge so this renewal does not get missed.",
          occurredAt: null,
          dueAt: inDays(occurredAt, 1),
          expiresAt: null,
          amount: null,
          currency: null,
          category: "DOCUMENT",
          recordType: null,
        }),
        action({
          type: "ADD_TIMELINE_EVENT",
          title: "Passport renewal planned",
          details: "KASA added the renewal to your life timeline.",
          occurredAt: occurredAt.toISOString(),
          dueAt: null,
          expiresAt: null,
          amount: null,
          currency: null,
          category: "DOCUMENT",
          recordType: null,
        }),
      ],
    };
  }

  if (
    /\b(salary|paycheck|pay cheque)\b.*\b(aa gay|aagayi|arriv(?:ed|al)|received|credit|mil gay)/i.test(
      text,
    )
  ) {
    return {
      summary: "Salary income was added to your finance history and timeline.",
      confidence: 0.94,
      needsClarification: false,
      clarificationQuestion: null,
      actions: [
        action({
          type: "UPSERT_LIFE_RECORD",
          title: "Salary received",
          details: "Income recorded from Quick Capture.",
          occurredAt: occurredAt.toISOString(),
          dueAt: null,
          expiresAt: null,
          amount: null,
          currency: "INR",
          category: "INCOME",
          recordType: "CAREER",
        }),
        action({
          type: "ADD_TIMELINE_EVENT",
          title: "Salary received",
          details: "Monthly income event added to your finance timeline.",
          occurredAt: occurredAt.toISOString(),
          dueAt: null,
          expiresAt: null,
          amount: null,
          currency: "INR",
          category: "FINANCE",
          recordType: null,
        }),
      ],
    };
  }

  return null;
}

export async function planAutomation(input: {
  rawText: string;
  source: AutomationSource;
  userId: string;
  timezone: string;
  occurredAt: Date;
}) {
  const lifecycle = lifecyclePlan(
    input.rawText,
    input.occurredAt,
    input.timezone,
  );
  if (lifecycle) return { plan: lifecycle, planner: "lifecycle-rules-v1" };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    return { plan: fallbackPlan(input.rawText), planner: "rules-v1" };

  const model = process.env.OPENAI_AUTOMATION_MODEL || "gpt-4o-mini";
  const safetyIdentifier = createHash("sha256")
    .update(input.userId)
    .digest("hex")
    .slice(0, 32);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1_200,
        safety_identifier: safetyIdentifier,
        instructions: [
          "You are KASA's private Life Automation planner.",
          "Understand English, Hindi, Hinglish, Indian SMS and email wording.",
          "The user should be able to speak naturally once; infer the intent and perform the useful organization work without asking them to choose a category.",
          "Classify actionable work as CREATE_TASK. Use CREATE_REMINDER when the user explicitly asks to be reminded or when a time-sensitive commitment needs an alert. A dated obligation may need both a task and a reminder when both add distinct value.",
          "Classify a new concept, feature thought, business thought, or creative thought as SAVE_IDEA; a needed purchase as ADD_SHOPPING_ITEM; a past payment as LOG_EXPENSE; and a long-term aspiration as ADD_WISH.",
          "Resolve relative Hindi, Hinglish, and English dates such as kal, parso, agle hafte, tomorrow, next Friday using the supplied timezone and occurrence time.",
          "Write short, polished action titles that state the intended outcome instead of repeating filler words from the user's sentence.",
          "Prefer the smallest non-redundant action set. A simple signal should normally produce one best action.",
          "Do not create a generic task for something already represented as a shopping item, idea, wish, or expense. Add another action only when it creates genuinely different value, such as a requested reminder or a meaningful timeline milestone.",
          "Return every genuinely useful additive action implied by a complex signal, not duplicate representations of the same intent.",
          "Example: buying a bike can add a timeline event, create a VEHICLE life record, and add future service or insurance reminders only when dates are known.",
          "For a trip with a known month, create one CREATE_TASK, one CREATE_CALENDAR_EVENT, a CREATE_CHECKLIST with practical line-separated items, a TRIP life record for any budget context, and only the reminders that help at the right time.",
          "A receipt can log an expense and add a meaningful purchase timeline event.",
          "Never invent amounts, dates, document numbers, people, or completed events.",
          "Do not create a reminder unless a usable date is stated or strongly implied.",
          "Ask one concise clarification only when acting would be materially wrong; do not ask the user to select Task, Reminder, Idea, Expense, Shopping, or Wish.",
          "Actions are proposals only; you cannot access databases or external services.",
        ].join(" "),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Source: ${input.source}\nTimezone: ${input.timezone}\nOccurred at: ${input.occurredAt.toISOString()}\nSignal:\n${input.rawText}`,
              },
            ],
          },
        ],
        text: { format: responseFormat },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) throw new Error(`OpenAI ${response.status}`);
    const text = outputText((await response.json()) as OpenAIResponse);
    if (!text) throw new Error("OpenAI returned no output text");
    const parsed = automationPlanSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new Error("OpenAI returned an invalid plan");
    return { plan: parsed.data, planner: `openai-${model}` };
  } catch (error) {
    console.warn(
      "KASA automation planner fallback",
      error instanceof Error ? error.message : "Unknown error",
    );
    return { plan: fallbackPlan(input.rawText), planner: "rules-v1" };
  }
}
