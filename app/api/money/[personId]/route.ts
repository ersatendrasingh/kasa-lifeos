import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const cleanPhone = (value?: string | null) =>
  (value || "").replace(/\D/g, "").slice(-10);
const profilePhone = (value: unknown) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  typeof (value as { phone?: unknown }).phone === "string"
    ? cleanPhone((value as { phone: string }).phone)
    : "";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const id = await userId(request);
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { personId } = await params;
  const person = await db.person.findFirst({
    where: { id: personId, userId: id },
    select: { id: true, name: true, phone: true },
  });
  if (!person)
    return Response.json({ error: "Contact not found" }, { status: 404 });
  const entries = await db.ledgerEntry.findMany({
    where: { userId: id, personId },
    select: { direction: true, amount: true },
  });
  const balance = entries.reduce(
    (sum, entry) =>
      sum +
      (entry.direction === "LENT" || entry.direction === "PAID"
        ? Number(entry.amount)
        : -Number(entry.amount)),
    0,
  );
  if (balance <= 0)
    return Response.json(
      { error: "A reminder is available only when they owe you money." },
      { status: 400 },
    );
  const targetPhone = cleanPhone(person.phone);
  if (!targetPhone)
    return Response.json(
      {
        error: "This contact needs a phone number to receive a KASA reminder.",
      },
      { status: 400 },
    );
  const profiles = await db.userProfile.findMany({
    select: { userId: true, preferences: true },
  });
  const target = profiles.find(
    (profile) =>
      profile.userId !== id &&
      profilePhone(profile.preferences) === targetPhone,
  );
  if (!target)
    return Response.json(
      { error: `${person.name} is not available on KASA yet.` },
      { status: 404 },
    );
  const sender = await db.user.findUnique({
    where: { id },
    select: { name: true },
  });
  const notification = await db.notification.create({
    data: {
      userId: target.userId,
      channel: "PUSH",
      title: "Khata reminder",
      body: `${sender?.name || "Someone"} is waiting for ₹${balance.toLocaleString("en-IN")} from you.`,
      scheduledAt: new Date(),
      metadata: {
        category: "FINANCE",
        kind: "KHATA_REMINDER",
        amount: balance,
      },
    },
  });
  return Response.json({ notification });
}
