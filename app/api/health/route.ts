import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  addHealthEntries,
  addHealthEntry,
  getHealthEntries,
} from "@/lib/health/service";
import { healthEntryTypes } from "@/lib/health/types";

const createSchema = z.object({
  type: z.enum(healthEntryTypes),
  value: z.number().finite().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(24),
  recordedAt: z.coerce.date(),
  source: z.enum(["manual", "smart-scale"]).default("manual"),
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
});

const createBatchSchema = z.object({
  sessionId: z.string().trim().min(8).max(160),
  entries: z.array(createSchema).min(1).max(40),
});

async function userId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

export async function GET(request: Request) {
  const id = await userId(request);
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ entries: await getHealthEntries(id) });
}

export async function POST(request: Request) {
  const id = await userId(request);
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body: unknown = await request.json();
  const isBatch =
    typeof body === "object" && body !== null && "entries" in body;
  const parsed = (isBatch ? createBatchSchema : createSchema).safeParse(body);
  if (!parsed.success) {
    console.error("[health] Invalid health payload", parsed.error.flatten());
    return Response.json(
      {
        error: isBatch
          ? "One or more scale measurements could not be saved."
          : "Please check this health entry.",
      },
      { status: 400 },
    );
  }
  if ("entries" in parsed.data) {
    const entries = await addHealthEntries(
      id,
      parsed.data.entries,
      parsed.data.sessionId,
    );
    return Response.json({ entries }, { status: 201 });
  }
  const entry = await addHealthEntry(id, {
    ...parsed.data,
  });
  return Response.json({ entry }, { status: 201 });
}
