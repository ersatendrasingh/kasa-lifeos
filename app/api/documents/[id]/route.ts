import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toCategorySlug } from "@/lib/documents/categories";
import { getDocument, syncDocumentReminders } from "@/lib/documents/service";
import { deleteVaultDocument } from "@/lib/storage/s3";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  categorySlug: z.string().trim().max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  notes: z.string().trim().max(4_000).nullable().optional(),
  favorite: z.boolean().optional(),
  // Accepts YYYY-MM-DD or null to clear the date.
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export async function GET(request: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const document = await getDocument(session.user.id, id);
  if (!document) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ document });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid changes" }, { status: 400 });
  }

  // Confirms ownership before writing; updateMany-style filters would silently
  // no-op instead of reporting a missing document.
  const existing = await db.document.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { expiresAt, categorySlug, ...rest } = parsed.data;
  const document = await db.document.update({
    where: { id },
    data: {
      ...rest,
      ...(categorySlug !== undefined
        ? { categorySlug: toCategorySlug(categorySlug) || "others" }
        : {}),
      ...(expiresAt !== undefined
        ? {
            expiresAt: expiresAt
              ? new Date(`${expiresAt}T00:00:00.000Z`)
              : null,
          }
        : {}),
    },
  });

  // Reminders are derived from the expiry date, so they are rebuilt whenever it
  // is touched — including when it is cleared.
  if (expiresAt !== undefined) {
    await syncDocumentReminders(document.id, document.expiresAt);
  }

  return Response.json({ document });
}

export async function DELETE(request: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await db.document.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, objectKey: true },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Row first, then the object: an orphaned S3 file is recoverable waste, while a
  // row pointing at a deleted object is a broken document in the user's vault.
  await db.document.delete({ where: { id: existing.id } });
  try {
    await deleteVaultDocument(existing.objectKey);
  } catch (error) {
    console.warn(
      "KASA vault object delete failed",
      error instanceof Error ? error.message : "Unknown storage error",
    );
  }

  return Response.json({ ok: true });
}
