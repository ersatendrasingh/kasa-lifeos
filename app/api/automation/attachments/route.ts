import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { signedAttachmentUrl } from "@/lib/storage/s3";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db.automationAttachment.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      eventId: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      kind: true,
      createdAt: true,
      objectKey: true,
    },
  });
  const attachments = await Promise.all(
    rows.map(async ({ objectKey, ...row }) => ({
      ...row,
      previewUrl: await signedAttachmentUrl(objectKey),
    })),
  );
  return Response.json({ attachments });
}
