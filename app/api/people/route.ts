import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { personCategories } from "@/lib/people/types";

const personSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(32).optional().nullable(),
  email: z.string().trim().email().max(180).optional().nullable(),
  company: z.string().trim().max(100).optional().nullable(),
  role: z.string().trim().max(100).optional().nullable(),
  category: z.enum(personCategories).default("FRIEND"),
  tags: z.array(z.string().trim().min(1).max(28)).max(12).default([]),
  birthday: z.coerce.date().optional().nullable(),
  anniversary: z.coerce.date().optional().nullable(),
  address: z.string().trim().max(800).optional().nullable(),
  trustLevel: z.number().int().min(1).max(5).default(3),
  favorite: z.boolean().default(false),
  bloodGroup: z.string().trim().max(8).optional().nullable(),
  emergency: z.boolean().default(false),
});

const importSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(100),
        phone: z.string().trim().min(3).max(32).optional(),
        email: z.string().trim().email().max(180).optional(),
      }),
    )
    .min(1)
    .max(2_000),
});

async function userId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

export async function GET(request: Request) {
  const id = await userId(request);
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const category = url.searchParams.get("category");
  const favorite = url.searchParams.get("favorite") === "true";
  const people = await db.person.findMany({
    where: {
      userId: id,
      ...(favorite ? { favorite: true } : {}),
      ...(category && personCategories.includes(category as (typeof personCategories)[number])
        ? { category }
        : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { company: { contains: query, mode: "insensitive" } },
              { role: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { memories: { some: { OR: [{ title: { contains: query, mode: "insensitive" } }, { detail: { contains: query, mode: "insensitive" } }] } } },
            ],
          }
        : {}),
    },
    orderBy: [{ favorite: "desc" }, { lastContactAt: "desc" }, { updatedAt: "desc" }],
    include: { _count: { select: { memories: true } } },
  });
  return Response.json({ people });
}

export async function POST(request: Request) {
  const id = await userId(request);
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body: unknown = await request.json();
  const importParsed =
    typeof body === "object" && body !== null && "contacts" in body
      ? importSchema.safeParse(body)
      : null;
  if (importParsed?.success) {
    const existing = await db.person.findMany({
      where: { userId: id, phone: { in: importParsed.data.contacts.flatMap((contact) => contact.phone ? [contact.phone] : []) } },
      select: { phone: true, name: true },
    });
    const known = new Set(existing.flatMap((person) => person.phone ? [`phone:${person.phone}`] : []).concat(existing.map((person) => `name:${person.name.toLowerCase()}`)));
    const unique = importParsed.data.contacts.filter((contact) => {
      const key = contact.phone ? `phone:${contact.phone}` : `name:${contact.name.toLowerCase()}`;
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    if (unique.length) {
      await db.person.createMany({
        data: unique.map((contact) => ({ userId: id, name: contact.name, phone: contact.phone ?? null, email: contact.email ?? null, category: "OTHER", tags: ["Phone contact"] })),
      });
    }
    return Response.json({ imported: unique.length, skipped: importParsed.data.contacts.length - unique.length });
  }
  if (importParsed && !importParsed.success) return Response.json({ error: "Could not import these contacts." }, { status: 400 });
  const parsed = personSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please check this person's details." }, { status: 400 });
  if (parsed.data.phone) {
    const existing = await db.person.findFirst({
      where: { userId: id, phone: parsed.data.phone },
    });
    if (existing) return Response.json({ person: existing });
  }
  const person = await db.person.create({ data: { ...parsed.data, userId: id, tags: parsed.data.tags } });
  await db.personMemory.create({
    data: { userId: id, personId: person.id, kind: "NOTE", title: "Profile created", detail: "Added to your Relationship Hub." },
  });
  return Response.json({ person }, { status: 201 });
}
