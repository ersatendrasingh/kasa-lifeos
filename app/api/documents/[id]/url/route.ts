import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  signedDocumentDownloadUrl,
  signedDocumentViewUrl,
} from "@/lib/storage/s3";

type Params = { params: Promise<{ id: string }> };

/*
 * Issues a short-lived signed URL for a document.
 *
 * Signed URLs are minted per request rather than stored on the document, because
 * a signed URL is a bearer credential — anyone holding it can read the file until
 * it expires. Keeping them ephemeral and out of the database means access always
 * flows through this ownership check.
 */
export async function GET(request: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const document = await db.document.findFirst({
    where: { id, userId: session.user.id },
    select: { objectKey: true, originalFileName: true, mimeType: true },
  });
  if (!document) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "true";
  try {
    const url = download
      ? await signedDocumentDownloadUrl(
          document.objectKey,
          document.originalFileName,
        )
      : await signedDocumentViewUrl(document.objectKey);
    return Response.json({ url, mimeType: document.mimeType });
  } catch (error) {
    console.warn(
      "KASA signed URL failed",
      error instanceof Error ? error.message : "Unknown storage error",
    );
    return Response.json(
      { error: "Could not open this file" },
      { status: 503 },
    );
  }
}
