import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { personCategories } from "@/lib/people/types";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  email: z.string().trim().email().max(180).nullable().optional(),
  company: z.string().trim().max(100).nullable().optional(),
  role: z.string().trim().max(100).nullable().optional(),
  category: z.enum(personCategories).optional(),
  tags: z.array(z.string().trim().min(1).max(28)).max(12).optional(),
  favorite: z.boolean().optional(),
  trustLevel: z.number().int().min(1).max(5).optional(),
  emergency: z.boolean().optional(),
});

async function userId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

export async function GET(request: Request, context: RouteContext<"/api/people/[id]">) {
  const id = await userId(request);
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id: personId } = await context.params;
  const person = await db.person.findFirst({
    where: { id: personId, userId: id },
    include: { memories: { orderBy: { occurredAt: "desc" }, take: 80 } },
  });
  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });
  return Response.json({ person });
}

export async function PATCH(request: Request, context: RouteContext<"/api/people/[id]">) {
  const id = await userId(request);
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id: personId } = await context.params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Please check these details." }, { status: 400 });
  const updated = await db.person.updateMany({ where: { id: personId, userId: id }, data: parsed.data });
  if (!updated.count) return Response.json({ error: "Person not found" }, { status: 404 });
  return Response.json({ person: await db.person.findFirst({ where: { id: personId, userId: id } }) });
}

export async function DELETE(request: Request, context: RouteContext<"/api/people/[id]">) {
  const id = await userId(request);
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id: personId } = await context.params;
  const removed = await db.person.deleteMany({ where: { id: personId, userId: id } });
  if (!removed.count) return Response.json({ error: "Person not found" }, { status: 404 });
  return Response.json({ success: true });
}
