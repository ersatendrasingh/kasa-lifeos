import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const policySchema = z.object({
  source: z.enum([
    "EMAIL",
    "CALENDAR",
    "SMS",
    "HEALTH",
    "LOCATION",
    "CONTACTS",
    "NOTIFICATION",
    "BROWSER",
    "WHATSAPP",
  ]),
  mode: z.enum(["REVIEW_FIRST", "AUTO_SAFE", "PAUSED"]),
});

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [connections, policies] = await Promise.all([
    db.automationConnection.findMany({
      where: { userId: session.user.id },
      orderBy: { provider: "asc" },
    }),
    db.automationPolicy.findMany({ where: { userId: session.user.id } }),
  ]);
  return Response.json({ connections, policies });
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = policySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid automation policy" },
      { status: 400 },
    );
  }
  const policy = await db.automationPolicy.upsert({
    where: {
      userId_source: { userId: session.user.id, source: parsed.data.source },
    },
    create: { userId: session.user.id, ...parsed.data },
    update: { mode: parsed.data.mode },
  });
  return Response.json({ policy });
}
