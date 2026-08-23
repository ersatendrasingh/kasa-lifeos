import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await db.automationEvent.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      source: true,
      rawText: true,
      summary: true,
      status: true,
      confidence: true,
      occurredAt: true,
      createdAt: true,
      actions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          title: true,
          status: true,
          confidence: true,
          requiresReview: true,
        },
      },
    },
  });

  return Response.json({ events });
}
