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

export async function planAutomation(input: {
  rawText: string;
  source: AutomationSource;
  userId: string;
  timezone: string;
  occurredAt: Date;
}) {
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
