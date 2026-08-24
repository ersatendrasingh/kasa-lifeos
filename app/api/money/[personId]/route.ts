import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function userId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const id = await userId(request);
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { personId } = await params;
  const [person, entries] = await Promise.all([
    db.person.findFirst({
      where: { id: personId, userId: id },
      select: { id: true, name: true, phone: true, category: true },
    }),
    db.ledgerEntry.findMany({
      where: { userId: id, personId },
      orderBy: { occurredAt: "asc" },
      take: 500,
    }),
  ]);
  if (!person)
    return Response.json({ error: "Contact not found" }, { status: 404 });
  const balance = entries.reduce(
    (sum, entry) =>
      sum +
      (entry.direction === "LENT" || entry.direction === "PAID"
        ? Number(entry.amount)
        : -Number(entry.amount)),
    0,
  );
  return Response.json({
    person: { ...person, balance },
    entries: entries.map((entry) => ({
      ...entry,
      amount: Number(entry.amount),
    })),
  });
}
