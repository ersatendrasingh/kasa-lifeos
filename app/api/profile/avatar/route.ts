import { Buffer } from "node:buffer";

import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { storeProfileAvatar } from "@/lib/storage/s3";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(160),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  fileData: z.string().min(4),
});

function validBase64(value: string) {
  const compact = value.replace(/\s/g, "");
  return compact.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(compact);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = uploadSchema.safeParse(await request.json());
  if (!parsed.success || !validBase64(parsed.data.fileData)) {
    return Response.json(
      { error: "Choose a valid JPG, PNG or WebP image." },
      { status: 400 },
    );
  }
  if (!allowedMimeTypes.includes(parsed.data.mimeType)) {
    return Response.json(
      { error: "Choose a JPG, PNG or WebP image." },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(parsed.data.fileData, "base64");
  if (!bytes.length || bytes.length > MAX_AVATAR_BYTES) {
    return Response.json(
      { error: "Profile photo must be smaller than 5 MB." },
      { status: 400 },
    );
  }

  const objectKey = await storeProfileAvatar({
    userId: session.user.id,
    fileName: parsed.data.fileName,
    mimeType: parsed.data.mimeType,
    bytes,
  });
  await db.user.update({
    where: { id: session.user.id },
    data: { image: objectKey },
  });

  return Response.json({ imageKey: objectKey }, { status: 201 });
}
