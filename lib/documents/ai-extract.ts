import { documentCategorySlugs } from "@/lib/documents/categories";
import {
  detectIdentityNumber,
  redactIdentityNumbers,
} from "@/lib/documents/redaction";

/*
 * AI document understanding.
 *
 * The product promise is that saving a document requires no typing: the model
 * reads the file and fills in the name, category, expiry, tags and the aliases
 * that make it findable later. The user only confirms.
 *
 * Extraction must never block a save. If the key is missing, the model errors,
 * or the response is unusable, this falls back to filename-derived values and
 * reports low confidence — a document saved with a mediocre title still beats a
 * failed upload, because the file itself is what the user came to store.
 */

export type DocumentExtraction = {
  title: string;
  categorySlug: string;
  /// Alternate names to search by: a driving licence yields ["DL", "Licence"].
  aliases: string[];
  tags: string[];
  /// Identity numbers are already masked; see lib/documents/redaction.ts.
  ocrText: string | null;
  idNumberMasked: string | null;
  idNumberLast4: string | null;
  idNumberLabel: string | null;
  issuedOn: string | null;
  expiresAt: string | null;
  confidence: number;
  /// True when values came from the model rather than the filename fallback.
  aiUsed: boolean;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

/*
 * Mirrors the existing automation extract route: the Responses API returns text
 * either flattened into `output_text` or nested per content block.
 */
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

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "category",
    "aliases",
    "tags",
    "documentText",
    "identityNumber",
    "issuedOn",
    "expiresAt",
    "confidence",
  ],
  properties: {
    title: {
      type: "string",
      description:
        "Short human name for this document, e.g. 'Passport' or 'HDFC Bank Statement'. Prefer what a person would call it, not the issuer's formal heading.",
    },
    category: {
      type: "string",
      enum: documentCategorySlugs,
      description: "Best matching category slug.",
    },
    aliases: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
      description:
        "Other names or abbreviations someone might search for this document, e.g. ['DL','Licence','Driving Licence'] for a driving licence, ['Aadhar','UIDAI'] for an Aadhaar card. Include common misspellings.",
    },
    tags: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
      description:
        "Lowercase topical tags, e.g. ['travel','identity','government'].",
    },
    documentText: {
      type: "string",
      description:
        "All readable text from the document, for search. Empty string if none.",
    },
    identityNumber: {
      type: "string",
      description:
        "The single most important identifying number exactly as printed (Aadhaar, PAN, passport, policy or account number). Empty string if none.",
    },
    issuedOn: {
      type: "string",
      description: "Issue date as YYYY-MM-DD, or empty string if absent.",
    },
    expiresAt: {
      type: "string",
      description:
        "Expiry / valid-until date as YYYY-MM-DD, or empty string if absent. Never guess this.",
    },
    confidence: {
      type: "number",
      description: "0 to 1 confidence in the extracted fields.",
    },
  },
} as const;

const instructions = [
  "You are cataloguing a personal document for a private vault.",
  "Read it and return structured fields so the owner never has to type them.",
  "Use only what is visible; never invent dates, numbers or issuers.",
  "For expiry, use the document's own validity or expiry date only.",
  "Aliases matter: include the short forms people actually search by.",
].join(" ");

/*
 * Removes empty strings the schema requires the model to send for absent values,
 * so callers deal in nulls rather than "".
 */
function nullIfBlank(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/*
 * Accepts a date only if it is a real calendar date. The model returns
 * YYYY-MM-DD, but a hallucinated "2024-02-31" would otherwise become a silently
 * shifted Date and produce a wrong expiry reminder.
 */
function parseDate(value: unknown) {
  const raw = nullIfBlank(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCMonth() + 1 !== Number(month)) return null;
  if (date.getUTCDate() !== Number(day)) return null;
  return date.toISOString();
}

function cleanList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim().slice(0, 40);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= limit) break;
  }
  return result;
}

/*
 * Turns a filename into a presentable title, used when AI is unavailable.
 * "scan_passport-2024 (1).pdf" becomes "Scan Passport 2024".
 */
export function titleFromFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[a-z0-9]{1,10}$/i, "");
  const cleaned = withoutExtension
    .replace(/[_\-.]+/g, " ")
    .replace(/\(\d+\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Untitled document";
  return cleaned
    .split(" ")
    .map((word) =>
      word.length > 2 ? word[0].toUpperCase() + word.slice(1) : word,
    )
    .join(" ")
    .slice(0, 120);
}

function fallbackExtraction(fileName: string): DocumentExtraction {
  return {
    title: titleFromFileName(fileName),
    categorySlug: "others",
    aliases: [],
    tags: [],
    ocrText: null,
    idNumberMasked: null,
    idNumberLast4: null,
    idNumberLabel: null,
    issuedOn: null,
    expiresAt: null,
    confidence: 0,
    aiUsed: false,
  };
}

/*
 * Reads a document with the vision model and returns fields ready to persist.
 *
 * Identity numbers are masked and OCR text redacted here, at the boundary, so no
 * caller can accidentally store a full number.
 */
export async function extractDocumentFields(input: {
  fileName: string;
  mimeType: string;
  base64: string;
}): Promise<DocumentExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackExtraction(input.fileName);

  const dataUrl = `data:${input.mimeType};base64,${input.base64}`;
  const content = input.mimeType.startsWith("image/")
    ? [
        { type: "input_text", text: instructions },
        { type: "input_image", image_url: dataUrl, detail: "high" },
      ]
    : [
        { type: "input_text", text: instructions },
        {
          type: "input_file",
          filename: input.fileName,
          file_data: dataUrl,
        },
      ];

  let raw: string | null = null;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
        // The file may contain identity documents; opt out of retention.
        store: false,
        max_output_tokens: 2_000,
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "document_fields",
            strict: true,
            schema: extractionSchema,
          },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) {
      console.warn(
        "KASA document extraction failed",
        response.status,
        (await response.text()).slice(0, 500),
      );
      return fallbackExtraction(input.fileName);
    }
    raw = outputText((await response.json()) as OpenAIResponse);
  } catch (error) {
    console.warn(
      "KASA document extraction error",
      error instanceof Error ? error.message : "Unknown error",
    );
    return fallbackExtraction(input.fileName);
  }

  if (!raw?.trim()) return fallbackExtraction(input.fileName);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.warn("KASA document extraction returned non-JSON output");
    return fallbackExtraction(input.fileName);
  }

  const documentText = nullIfBlank(parsed.documentText);
  const declaredNumber = nullIfBlank(parsed.identityNumber);

  /*
   * Prefer the number the model isolated, but fall back to scanning the OCR text
   * so a missed field does not lose the searchable last four digits.
   */
  const detected = declaredNumber
    ? detectIdentityNumber(declaredNumber)
    : documentText
      ? detectIdentityNumber(documentText)
      : null;

  const category = documentCategorySlugs.includes(String(parsed.category))
    ? String(parsed.category)
    : "others";

  const confidence =
    typeof parsed.confidence === "number" &&
    parsed.confidence >= 0 &&
    parsed.confidence <= 1
      ? parsed.confidence
      : 0.5;

  return {
    title:
      nullIfBlank(parsed.title)?.slice(0, 120) ??
      titleFromFileName(input.fileName),
    categorySlug: category,
    aliases: cleanList(parsed.aliases, 6),
    tags: cleanList(parsed.tags, 6).map((tag) => tag.toLowerCase()),
    // Redacted so the searchable column never holds a full identity number.
    ocrText: documentText
      ? redactIdentityNumbers(documentText).slice(0, 20_000)
      : null,
    idNumberMasked: detected?.masked ?? null,
    idNumberLast4: detected?.last4 ?? null,
    idNumberLabel: detected?.label ?? null,
    issuedOn: parseDate(parsed.issuedOn),
    expiresAt: parseDate(parsed.expiresAt),
    confidence,
    aiUsed: true,
  };
}
