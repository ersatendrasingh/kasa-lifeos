import { addDays, setHours, setMinutes } from "date-fns";

export const captureCategories = [
  "TASK",
  "REMINDER",
  "IDEA",
  "EXPENSE",
  "SHOPPING",
  "WISH",
] as const;

export type CaptureCategoryValue = (typeof captureCategories)[number];

export type BrainDumpClassification = {
  category: CaptureCategoryValue;
  title: string;
  confidence: number;
  dueAt?: Date;
  amount?: string;
  currency?: string;
  signals: string[];
  actionSummary: string;
  classifier: "AI" | "RULES";
};

const categorySignals: Record<
  CaptureCategoryValue,
  Array<{ pattern: RegExp; weight: number; signal: string }>
> = {
  TASK: [
    {
      pattern:
        /\b(service|renew|learn|call|apply|submit|finish|complete|send|book|schedule|update|fix|baat|karna|karni)\b/i,
      weight: 4,
      signal: "action language",
    },
  ],
  REMINDER: [
    {
      pattern: /\b(remind|reminder|yaad|due|deadline|expires?|expiry)\b/i,
      weight: 7,
      signal: "reminder language",
    },
    {
      pattern:
        /\b(today|tomorrow|tonight|morning|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      weight: 3,
      signal: "time language",
    },
  ],
  IDEA: [
    {
      pattern: /\b(idea|concept|brainstorm|what if|feature|invention)\b/i,
      weight: 8,
      signal: "idea language",
    },
  ],
  EXPENSE: [
    {
      pattern: /(?:₹|\brs\.?\s*|\binr\s*)[\d,]+(?:\.\d{1,2})?/i,
      weight: 7,
      signal: "money amount",
    },
    {
      pattern: /\b(paid|spent|expense|payment|charged|debited|bill paid)\b/i,
      weight: 6,
      signal: "expense language",
    },
  ],
  SHOPPING: [
    {
      pattern:
        /\b(buy|purchase|shopping|grocery|groceries|milk|bread|vegetables?|amazon|cart|khatam|finished|out of)\b/i,
      weight: 5,
      signal: "shopping language",
    },
  ],
  WISH: [
    {
      pattern:
        /\b(wish|wishlist|dream|someday|one day|eventually|saving goal|want to own|trip to)\b/i,
      weight: 8,
      signal: "aspiration language",
    },
    {
      pattern: /\b(phone|laptop|bike|camera|car|trip)\b/i,
      weight: 2,
      signal: "wishlist item",
    },
  ],
};

function normalizeTitle(input: string) {
  const cleaned = input
    .trim()
    .replace(/^(remind me to|reminder to|idea for|idea:|task:|buy)\s+/i, "")
    .replace(/\s+/g, " ");

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function extractAmount(input: string) {
  const match = input.match(/(?:₹|\brs\.?\s*|\binr\s*)([\d,]+(?:\.\d{1,2})?)/i);

  if (!match) return undefined;
  return match[1].replaceAll(",", "");
}

function extractDueAt(input: string, now: Date) {
  const lower = input.toLowerCase();
  let date = lower.includes("today") ? now : addDays(now, 1);

  if (lower.includes("tomorrow")) date = addDays(now, 1);

  const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  let hour = lower.includes("evening") ? 18 : lower.includes("morning") ? 9 : 9;
  let minute = 0;

  if (timeMatch) {
    hour = Number(timeMatch[1]) % 12;
    if (timeMatch[3] === "pm") hour += 12;
    minute = Number(timeMatch[2] ?? 0);
  }

  date = setMinutes(setHours(date, hour), minute);
  return date;
}

export function classifyBrainDump(
  input: string,
  now = new Date(),
): BrainDumpClassification {
  const scores = new Map<CaptureCategoryValue, number>(
    captureCategories.map((category) => [
      category,
      category === "TASK" ? 1 : 0,
    ]),
  );
  const matchedSignals = new Map<CaptureCategoryValue, string[]>();

  for (const category of captureCategories) {
    for (const rule of categorySignals[category]) {
      if (!rule.pattern.test(input)) continue;
      scores.set(category, (scores.get(category) ?? 0) + rule.weight);
      matchedSignals.set(category, [
        ...(matchedSignals.get(category) ?? []),
        rule.signal,
      ]);
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [winner, winnerScore] = ranked[0];
  const runnerUpScore = ranked[1]?.[1] ?? 0;
  const margin = winnerScore - runnerUpScore;
  const confidence = Math.min(
    0.98,
    0.56 + winnerScore * 0.035 + margin * 0.025,
  );
  const amount = extractAmount(input);

  return {
    category: winner,
    title: normalizeTitle(input),
    confidence: Number(confidence.toFixed(2)),
    dueAt: winner === "REMINDER" ? extractDueAt(input, now) : undefined,
    amount,
    currency: amount ? "INR" : undefined,
    signals: matchedSignals.get(winner) ?? ["default action"],
    actionSummary: `Saved as ${winner.toLowerCase()}`,
    classifier: "RULES",
  };
}
