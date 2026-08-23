import { z } from "zod";
import type { Prisma } from "@/app/generated/prisma/client";

import { auth } from "@/lib/auth";
import { ingestAutomationEvent } from "@/lib/automation/service";
import { automationSources } from "@/lib/automation/types";

const ingestionSchema = z.object({
  source: z.enum(automationSources).default("MANUAL_TEXT"),
  text: z.string().trim().min(1).max(20_000),
  contentType: z.string().trim().max(120).optional(),
  sourceExternalId: z.string().trim().max(300).optional(),
  occurredAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = ingestionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid automation signal" },
      { status: 400 },
    );
  }

  const event = await ingestAutomationEvent({
    userId: session.user.id,
    source: parsed.data.source,
    rawText: parsed.data.text,
    contentType: parsed.data.contentType,
    sourceExternalId: parsed.data.sourceExternalId,
    occurredAt: parsed.data.occurredAt
      ? new Date(parsed.data.occurredAt)
      : undefined,
    metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
  });

  return Response.json({ event }, { status: 201 });
}
