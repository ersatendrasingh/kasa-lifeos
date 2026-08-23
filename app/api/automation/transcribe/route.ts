import { auth } from "@/lib/auth";
import { z } from "zod";

const audioSchema = z.object({
  fileData: z.string().min(1),
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Voice transcription is not configured" },
      { status: 503 },
    );
  }
  const parsed = audioSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Audio file is required" }, { status: 400 });
  }
  const bytes = Buffer.from(parsed.data.fileData, "base64");
  if (!bytes.length) {
    return Response.json({ error: "Audio file is empty" }, { status: 400 });
  }
  if (bytes.length > 15 * 1024 * 1024) {
    return Response.json(
      { error: "Audio must be under 15 MB" },
      { status: 413 },
    );
  }
  const file = new File([bytes], parsed.data.fileName, {
    type: parsed.data.mimeType,
  });

  const form = new FormData();
  form.set("file", file, file.name || "kasa-voice.m4a");
  form.set(
    "model",
    process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
  );
  form.set(
    "prompt",
    "KASA LifeOS voice note. Transcribe exactly as spoken; preserve Hindi script, Hinglish roman words and English. Do not translate in this transcription.",
  );
  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    console.warn("KASA transcription failed", response.status);
    return Response.json(
      { error: "Could not transcribe this voice note" },
      { status: 502 },
    );
  }
  const result = (await response.json()) as { text?: string };
  if (!result.text?.trim()) {
    return Response.json({ error: "No speech was detected" }, { status: 422 });
  }
  const text = result.text.trim();
  let englishText = text;
  try {
    const normalization = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_AUTOMATION_MODEL || "gpt-4o-mini",
        store: false,
        max_output_tokens: 320,
        instructions:
          "Translate this voice transcription to concise natural English for a private automation record. Preserve names, numbers, amounts, dates, intent and uncertainty. Return only the English text; do not add commentary.",
        input: text,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (normalization.ok) {
      const payload = (await normalization.json()) as {
        output_text?: string;
      };
      if (payload.output_text?.trim()) englishText = payload.output_text.trim();
    }
  } catch {
    // The original transcript is still safe for the automation planner, which
    // understands Hindi and Hinglish. Never make voice capture fail because
    // optional English normalization is unavailable.
  }

  return Response.json({ text, englishText });
}
