import type { Prisma } from "@/app/generated/prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { ingestAutomationEvent } from "@/lib/automation/service";
import { db } from "@/lib/db";
import { attachmentKind, storeAutomationAttachment } from "@/lib/storage/s3";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

const jsonUploadSchema = z.object({
  source: z.enum(["CAMERA", "DOCUMENT"]),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(160),
  fileData: z.string().min(1),
});

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

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Document AI is not configured" },
      { status: 503 },
    );
  }
  const contentType = request.headers.get("content-type") ?? "";
  let source: "CAMERA" | "DOCUMENT";
  let fileName: string;
  let mimeType: string;
  let base64: string;
  let fileSize: number;

  if (contentType.includes("application/json")) {
    const parsed = jsonUploadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid file upload" }, { status: 400 });
    }
    source = parsed.data.source;
    fileName = parsed.data.fileName;
    mimeType = parsed.data.mimeType;
    base64 = parsed.data.fileData;
    fileSize = Buffer.byteLength(base64, "base64");
  } else {
    const body = await request.formData();
    const file = body.get("file");
    source = body.get("source") === "CAMERA" ? "CAMERA" : "DOCUMENT";
    if (!(file instanceof File) || file.size === 0) {
      return Response.json(
        { error: "Choose a non-empty file to scan" },
        { status: 400 },
      );
    }
    fileName = file.name || "kasa-document";
    mimeType = file.type || "application/octet-stream";
    base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    fileSize = file.size;
  }

  if (fileSize === 0) {
    return Response.json({ error: "This file is empty" }, { status: 400 });
  }
  if (fileSize > 20 * 1024 * 1024) {
    return Response.json(
      { error: "File must be under 20 MB" },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(base64, "base64");
  let attachmentId: string;
  try {
    const objectKey = await storeAutomationAttachment({
      userId: session.user.id,
      fileName,
      mimeType,
      bytes,
    });
    const attachment = await db.automationAttachment.create({
      data: {
        userId: session.user.id,
        objectKey,
        originalFileName: fileName,
        mimeType,
        sizeBytes: fileSize,
        kind: attachmentKind(mimeType),
      },
    });
    attachmentId = attachment.id;
  } catch (error) {
    console.warn(
      "KASA attachment storage failed",
      error instanceof Error ? error.message : "Unknown storage error",
    );
    return Response.json(
      { error: "Could not securely store this file" },
      { status: 503 },
    );
  }

  const dataUrl = `data:${mimeType};base64,${base64}`;
  const content = mimeType.startsWith("image/")
    ? [
        {
          type: "input_text",
          text: "Understand this image as both a visual photo and a possible document. If text exists, extract names, dates, amounts, expiry dates and document type. If there is no text, describe the clearly visible subject, object or scene and identify a useful memory, purchase, place, person or life event when supported by the image. Never fail merely because the image has no text. Do not invent hidden facts.",
        },
        { type: "input_image", image_url: dataUrl, detail: "high" },
      ]
    : [
        {
          type: "input_text",
          text: "Extract the factual text and key life event from this file. Preserve names, dates, amounts, expiry dates and document type. Do not guess missing values.",
        },
        {
          type: "input_file",
          filename: fileName,
          file_data: dataUrl,
        },
      ];
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
      store: false,
      max_output_tokens: 1_200,
      input: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!response.ok) {
    const providerError = await response.text();
    console.warn(
      "KASA document extraction failed",
      response.status,
      providerError.slice(0, 1_000),
    );
    return Response.json(
      { error: "Could not read this document" },
      { status: 502 },
    );
  }
  const extractedText = outputText((await response.json()) as OpenAIResponse);
  if (!extractedText?.trim()) {
    return Response.json(
      { error: "No useful information was detected" },
      { status: 422 },
    );
  }

  const event = await ingestAutomationEvent({
    userId: session.user.id,
    source,
    rawText: extractedText.trim(),
    contentType: mimeType,
    metadata: {
      originalFileName: fileName,
      originalSize: fileSize,
      originalFileRetained: true,
      attachmentId,
    } as Prisma.InputJsonValue,
  });
  await db.automationAttachment.update({
    where: { id: attachmentId },
    data: { eventId: event.id },
  });
  return Response.json({ event }, { status: 201 });
}
