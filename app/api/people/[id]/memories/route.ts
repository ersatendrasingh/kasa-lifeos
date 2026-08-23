import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { personMemoryKinds } from "@/lib/people/types";

const memorySchema = z.object({
  kind: z.enum(personMemoryKinds).default("NOTE"),
  title: z.string().trim().min(2).max(180),
  detail: z.string().trim().max(4_000).optional().nullable(),
  occurredAt: z.coerce.date().optional(),
});

export async function POST(request: Request, context: RouteContext<"/api/people/[id]/memories">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id: personId } = await context.params;
  const parsed = memorySchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Please add a clear memory." }, { status: 400 });
  const person = await db.person.findFirst({ where: { id: personId, userId: session.user.id }, select: { id: true } });
  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });
  const memory = await db.$transaction(async (tx) => {
    const created = await tx.personMemory.create({ data: { ...parsed.data, detail: parsed.data.detail || null, userId: session.user.id, personId } });
    if (["CALL", "MEETING", "MESSAGE", "VISIT"].includes(created.kind)) {
      await tx.person.update({ where: { id: personId }, data: { lastContactAt: created.occurredAt } });
    }
    return created;
  });
  return Response.json({ memory }, { status: 201 });
}
