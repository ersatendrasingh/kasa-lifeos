import { createHash } from "node:crypto";

import { z } from "zod";

import {
  captureCategories,
  type BrainDumpClassification,
} from "@/lib/brain-dump/classifier";

const aiCaptureSchema = z.object({
  category: z.enum(captureCategories),
  title: z.string().trim().min(1).max(160),
  confidence: z.number().min(0).max(1),
  dueAt: z.string().datetime().nullable(),
  amount: z.number().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
  actionSummary: z.string().trim().min(1).max(180),
  signals: z.array(z.string().trim().min(1).max(60)).max(5),
});

const responseFormat = {
  type: "json_schema",
  name: "kasa_smart_capture",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      category: { type: "string", enum: captureCategories },
      title: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      dueAt: { type: ["string", "null"], format: "date-time" },
      amount: { type: ["number", "null"], minimum: 0 },
      currency: { type: ["string", "null"] },
      actionSummary: { type: "string" },
      signals: {
        type: "array",
        items: { type: "string" },
        maxItems: 5,
      },
    },
    required: [
      "category",
      "title",
      "confidence",
      "dueAt",
      "amount",
      "currency",
      "actionSummary",
      "signals",
    ],
  },
} as const;

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string } | null;
};

function getOutputText(payload: OpenAIResponse) {
  if (payload.output_text) return payload.output_text;
  for (const item of payload.output ?? []) {
    const text = item.content?.find(
      (content) => content.type === "output_text" && content.text,
    )?.text;
    if (text) return text;
  }
  return null;
}

export async function classifyCaptureWithAI(
  input: string,
  userId: string,
  now = new Date(),
): Promise<BrainDumpClassification | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_CAPTURE_MODEL || "gpt-4o-mini";
  const safetyIdentifier = createHash("sha256")
    .update(userId)
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
        max_output_tokens: 500,
        safety_identifier: safetyIdentifier,
        instructions: [
          "You are the intent engine for KASA, a private personal Life OS.",
          "Understand natural English, Hindi, and Hinglish without asking the user to format anything.",
          "Choose exactly one category: TASK for an actionable next step; REMINDER when a future time or expiry alert is central; IDEA for a thought to explore; EXPENSE for money already spent or paid; SHOPPING for something to buy or replace; WISH for a future aspiration or savings desire.",
          "Use a short clear title. Preserve names and important meaning.",
          "Only set dueAt when the user gives enough time information. Interpret relative dates using the supplied current date and Asia/Kolkata timezone.",
          "Only set amount when the user states one. Use INR unless another currency is explicit.",
          "actionSummary must briefly say what KASA will create, such as 'Reminder scheduled for tomorrow at 6 PM'.",
        ].join(" "),
        input: `Current date/time: ${now.toISOString()}\nUser capture: ${input}`,
        text: { format: responseFormat },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.warn("OpenAI Smart Inbox classification failed", response.status);
      return null;
    }

    const payload = (await response.json()) as OpenAIResponse;
    const outputText = getOutputText(payload);
    if (!outputText) {
      console.warn("OpenAI Smart Inbox returned no structured output");
      return null;
    }
    const parsed = aiCaptureSchema.safeParse(JSON.parse(outputText));
    if (!parsed.success) {
      console.warn("OpenAI Smart Inbox returned an invalid capture shape");
      return null;
    }

    return {
      category: parsed.data.category,
      title: parsed.data.title,
      confidence: Number(parsed.data.confidence.toFixed(2)),
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
      amount:
        parsed.data.amount === null ? undefined : String(parsed.data.amount),
      currency: parsed.data.currency ?? undefined,
      signals: parsed.data.signals,
      actionSummary: parsed.data.actionSummary,
      classifier: "AI",
    };
  } catch (error) {
    const reason = error instanceof Error ? error.name : "UnknownError";
    console.warn("OpenAI Smart Inbox fallback activated", reason);
    return null;
  }
}
