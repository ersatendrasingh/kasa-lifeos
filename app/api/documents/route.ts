import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { extractDocumentFields } from "@/lib/documents/ai-extract";
import {
  documentCategorySlugs,
  toCategorySlug,
} from "@/lib/documents/categories";
import { listDocuments, syncDocumentReminders } from "@/lib/documents/service";
import {
  attachmentKind,
  deleteVaultDocument,
  storeVaultDocument,
} from "@/lib/storage/s3";

/*
 * Life Vault documents API, shared by the web dashboard and the Expo app.
 *
 * POST accepts either multipart (web file input) or JSON base64 (React Native,
 * which has no reliable multipart story for local file URIs).
 */

const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

const jsonUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(160),
  fileData: z.string().min(1),
  categorySlug: z.string().trim().max(40).optional(),
});

function isValidBase64(value: string) {
  const data = value.replace(/\s/g, "");
  return (
    data.length > 0 &&
    data.length % 4 === 0 &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(data)
  );
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const expiry = url.searchParams.get("expiry");
  const sort = url.searchParams.get("sort");
  const documents = await listDocuments({
    userId: session.user.id,
    search: url.searchParams.get("q"),
    categorySlug: url.searchParams.get("category"),
    favoritesOnly: url.searchParams.get("favorites") === "true",
    kind: kind === "IMAGE" || kind === "PDF" ? kind : null,
    expiry:
      expiry === "upcoming" || expiry === "expired" || expiry === "none"
        ? expiry
        : null,
    sort:
      sort === "created" || sort === "title" || sort === "expiry"
        ? sort
        : "updated",
  });

  return Response.json({ documents });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const contentType = request.headers.get("content-type") ?? "";
  let fileName: string;
  let mimeType: string;
  let base64: string;
  let requestedCategory: string | undefined;

  try {
    if (contentType.includes("application/json")) {
      const parsed = jsonUploadSchema.safeParse(await request.json());
      if (!parsed.success || !isValidBase64(parsed.data.fileData)) {
        return Response.json({ error: "Invalid upload" }, { status: 400 });
      }
      fileName = parsed.data.fileName;
      mimeType = parsed.data.mimeType;
      base64 = parsed.data.fileData.replace(/\s/g, "");
      requestedCategory = parsed.data.categorySlug;
    } else {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return Response.json(
          { error: "Choose a file to upload" },
          { status: 400 },
        );
      }
      fileName = file.name || "document";
      mimeType = file.type || "application/octet-stream";
      base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      const category = form.get("categorySlug");
      requestedCategory = typeof category === "string" ? category : undefined;
    }
  } catch {
    return Response.json(
      { error: "Could not read this upload. Please choose the file again." },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(base64, "base64");
  if (bytes.byteLength === 0) {
    return Response.json({ error: "This file is empty" }, { status: 400 });
  }
  if (bytes.byteLength > MAX_BYTES) {
    return Response.json(
      { error: "File must be under 25 MB" },
      { status: 413 },
    );
  }
  if (!ALLOWED_MIME.includes(mimeType)) {
    return Response.json(
      { error: "Upload an image or a PDF" },
      { status: 415 },
    );
  }

  /*
   * The file is stored before extraction runs. Storage is the promise the user
   * cares about; AI is an enhancement, so a model outage must never cost someone
   * their document.
   */
  let objectKey: string;
  try {
    objectKey = await storeVaultDocument({ userId, fileName, mimeType, bytes });
  } catch (error) {
    console.warn(
      "KASA vault storage failed",
      error instanceof Error ? error.message : "Unknown storage error",
    );
    return Response.json(
      { error: "Could not securely store this file" },
      { status: 503 },
    );
  }

  const extraction = await extractDocumentFields({
    fileName,
    mimeType,
    base64,
  });

  /*
   * An explicit category from the client wins over the model's guess: the user
   * picked it deliberately, usually from the category screen they uploaded from.
   */
  const categorySlug = requestedCategory
    ? documentCategorySlugs.includes(requestedCategory)
      ? requestedCategory
      : toCategorySlug(requestedCategory) || "others"
    : extraction.categorySlug;

  try {
    const document = await db.document.create({
      data: {
        userId,
        objectKey,
        originalFileName: fileName,
        mimeType,
        sizeBytes: bytes.byteLength,
        kind: attachmentKind(mimeType),
        title: extraction.title,
        categorySlug,
        aliases: extraction.aliases,
        tags: extraction.tags,
        ocrText: extraction.ocrText,
        idNumberMasked: extraction.idNumberMasked,
        idNumberLast4: extraction.idNumberLast4,
        issuedOn: extraction.issuedOn ? new Date(extraction.issuedOn) : null,
        expiresAt: extraction.expiresAt ? new Date(extraction.expiresAt) : null,
        aiConfidence: extraction.aiUsed ? extraction.confidence : null,
        aiMetadata: {
          aiUsed: extraction.aiUsed,
          idNumberLabel: extraction.idNumberLabel,
        },
      },
    });

    await syncDocumentReminders(document.id, document.expiresAt);

    return Response.json({ document, extraction }, { status: 201 });
  } catch (error) {
    // Do not leave a private file orphaned when the database schema/connection
    // is unavailable after the object has already been stored.
    try {
      await deleteVaultDocument(objectKey);
    } catch {
      // The storage cleanup is best-effort; the original DB error is actionable.
    }
    console.warn(
      "KASA vault document record failed",
      error instanceof Error ? error.message : "Unknown storage error",
    );
    return Response.json(
      { error: "Could not save this document. Please try again shortly." },
      { status: 503 },
    );
  }
}
