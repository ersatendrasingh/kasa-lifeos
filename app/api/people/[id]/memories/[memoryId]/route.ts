import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; memoryId: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id: personId, memoryId } = await context.params;
  const removed = await db.personMemory.deleteMany({
    where: { id: memoryId, personId, userId: session.user.id },
  });
  if (!removed.count)
    return Response.json({ error: "History entry not found" }, { status: 404 });
  return Response.json({ success: true });
}
