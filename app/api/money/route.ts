import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const transactionSchema = z.object({
  action: z.literal("transaction"),
  kind: z.enum(["INCOME", "EXPENSE"]),
  title: z.string().trim().min(2).max(120),
  amount: z.number().positive().max(9_999_999),
  category: z.string().trim().max(48).optional(),
  note: z.string().trim().max(500).optional(),
  occurredAt: z.coerce.date().optional(),
});
const ledgerSchema = z.object({
  action: z.literal("ledger"),
  personId: z.string(),
  direction: z.enum(["LENT", "BORROWED", "RECEIVED", "PAID"]),
  amount: z.number().positive().max(9_999_999),
  note: z.string().trim().max(500).optional(),
  occurredAt: z.coerce.date().optional(),
});
const schema = z.union([transactionSchema, ledgerSchema]);
async function userId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

export async function GET(request: Request) {
  const id = await userId(request);
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [people, ledger, transactions, automatedExpenses, responsibilities] =
    await Promise.all([
      db.person.findMany({
        where: { userId: id },
        select: { id: true, name: true, phone: true, category: true },
        orderBy: [{ favorite: "desc" }, { name: "asc" }],
      }),
      db.ledgerEntry.findMany({
        where: { userId: id },
        include: { person: { select: { id: true, name: true, phone: true } } },
        orderBy: { occurredAt: "desc" },
        take: 100,
      }),
      db.moneyTransaction.findMany({
        where: { userId: id },
        orderBy: { occurredAt: "desc" },
        take: 100,
      }),
      db.expense.findMany({
        where: { userId: id, occurredAt: { gte: monthStart } },
        orderBy: { occurredAt: "desc" },
        take: 100,
      }),
      db.responsibility.findMany({
        where: { userId: id, active: true },
        select: {
          id: true,
          title: true,
          amount: true,
          nextDueAt: true,
        },
        orderBy: { nextDueAt: "asc" },
        take: 6,
      }),
    ]);
  const contacts = people
    .map((person) => {
      const entries = ledger.filter((entry) => entry.personId === person.id);
      const balance = entries.reduce(
        (sum, entry) =>
          sum +
          (entry.direction === "LENT" || entry.direction === "PAID"
            ? Number(entry.amount)
            : -Number(entry.amount)),
        0,
      );
      return { ...person, balance };
    })
    .filter((person) => person.balance !== 0);
  const manualMonth = transactions.filter(
    (item) => new Date(item.occurredAt) >= monthStart,
  );
  const income = manualMonth
    .filter((item) => item.kind === "INCOME")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const spend =
    manualMonth
      .filter((item) => item.kind === "EXPENSE")
      .reduce((sum, item) => sum + Number(item.amount), 0) +
    automatedExpenses.reduce(
      (sum, item) => sum + (item.amount ? Number(item.amount) : 0),
      0,
    );
  return Response.json({
    people,
    contacts,
    ledger: ledger.map((item) => ({ ...item, amount: Number(item.amount) })),
    transactions: transactions.map((item) => ({
      ...item,
      amount: Number(item.amount),
    })),
    automatedExpenses: automatedExpenses.map((item) => ({
      ...item,
      amount: item.amount ? Number(item.amount) : null,
    })),
    responsibilities: responsibilities.map((item) => ({
      ...item,
      amount: Number(item.amount),
    })),
    summary: { income, spend },
  });
}
export async function POST(request: Request) {
  const id = await userId(request);
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: "Check the money details." },
      { status: 400 },
    );
  const value = parsed.data;
  if (value.action === "ledger") {
    const person = await db.person.findFirst({
      where: { id: value.personId, userId: id },
    });
    if (!person)
      return Response.json({ error: "Contact not found" }, { status: 404 });
    await db.ledgerEntry.create({
      data: {
        userId: id,
        personId: value.personId,
        direction: value.direction,
        amount: value.amount,
        note: value.note || null,
        occurredAt: value.occurredAt ?? new Date(),
      },
    });
  } else
    await db.moneyTransaction.create({
      data: {
        userId: id,
        kind: value.kind,
        title: value.title,
        amount: value.amount,
        category: value.category || null,
        note: value.note || null,
        occurredAt: value.occurredAt ?? new Date(),
      },
    });
  return GET(request);
}
