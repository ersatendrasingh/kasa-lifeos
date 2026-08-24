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
const reverseDirection = {
  LENT: "BORROWED",
  BORROWED: "LENT",
  RECEIVED: "PAID",
  PAID: "RECEIVED",
} as const;
const directionCopy = {
  LENT: "gave",
  BORROWED: "received",
  RECEIVED: "received repayment from",
  PAID: "repaid",
} as const;
const cleanPhone = (value?: string | null) =>
  (value || "").replace(/\D/g, "").slice(-10);
const profilePhone = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const phone = (value as { phone?: unknown }).phone;
  return typeof phone === "string" ? cleanPhone(phone) : "";
};
async function userId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

async function recordLedgerEverywhere(input: {
  userId: string;
  person: { id: string; name: string; phone: string | null };
  direction: keyof typeof reverseDirection;
  amount: number;
  note?: string;
  occurredAt: Date;
}) {
  const entry = await db.ledgerEntry.create({
    data: {
      userId: input.userId,
      personId: input.person.id,
      direction: input.direction,
      amount: input.amount,
      note: input.note || null,
      occurredAt: input.occurredAt,
    },
  });
  const title = `Money ${directionCopy[input.direction]} ${input.person.name}`;
  const summary = `₹${input.amount.toLocaleString("en-IN")} · ${input.note || "Khata entry"}`;
  await Promise.all([
    db.timelineEvent.create({
      data: {
        userId: input.userId,
        type: "FINANCE",
        title,
        summary,
        occurredAt: input.occurredAt,
        sourceType: "MONEY_LEDGER",
        sourceId: entry.id,
        metadata: {
          personId: input.person.id,
          amount: input.amount,
          direction: input.direction,
        },
      },
    }),
    db.calendarEvent.create({
      data: {
        userId: input.userId,
        sourceEventId: entry.id,
        title,
        notes: summary,
        startsAt: input.occurredAt,
        allDay: false,
        budgetAmount: input.amount,
        currency: "INR",
      },
    }),
    db.personMemory.create({
      data: {
        userId: input.userId,
        personId: input.person.id,
        kind: "MONEY",
        title,
        detail: summary,
        occurredAt: input.occurredAt,
        sourceType: "MONEY_LEDGER",
        sourceId: entry.id,
      },
    }),
  ]);
  return entry;
}

async function mirrorToKasaContact(input: {
  senderId: string;
  senderName: string;
  senderPhone: string;
  person: { name: string; phone: string | null };
  direction: keyof typeof reverseDirection;
  amount: number;
  note?: string;
  occurredAt: Date;
}) {
  const phone = cleanPhone(input.person.phone);
  if (!phone) return;
  const profiles = await db.userProfile.findMany({
    select: { userId: true, preferences: true },
  });
  const recipient = profiles.find(
    (profile) =>
      profile.userId !== input.senderId &&
      profilePhone(profile.preferences) === phone,
  );
  if (!recipient) return;
  const existing = await db.person.findFirst({
    where: {
      userId: recipient.userId,
      OR: [
        { phone: input.senderPhone || "__none__" },
        { name: input.senderName },
      ],
    },
  });
  const recipientPerson =
    existing ||
    (await db.person.create({
      data: {
        userId: recipient.userId,
        name: input.senderName,
        phone: input.senderPhone || null,
        category: "OTHER",
        tags: ["KASA khata"],
      },
    }));
  const mirroredDirection = reverseDirection[input.direction];
  const mirrored = await recordLedgerEverywhere({
    userId: recipient.userId,
    person: recipientPerson,
    direction: mirroredDirection,
    amount: input.amount,
    note: input.note,
    occurredAt: input.occurredAt,
  });
  const action =
    input.direction === "LENT"
      ? "gave you"
      : input.direction === "BORROWED"
        ? "recorded money you gave them"
        : input.direction === "RECEIVED"
          ? "recorded your repayment"
          : "recorded their repayment to you";
  await db.notification.create({
    data: {
      userId: recipient.userId,
      channel: "PUSH",
      title: "Khata updated",
      body: `${input.senderName} ${action} ₹${input.amount.toLocaleString("en-IN")}.`,
      scheduledAt: new Date(),
      metadata: {
        category: "FINANCE",
        kind: "KHATA_ENTRY",
        personId: recipientPerson.id,
        ledgerEntryId: mirrored.id,
        path: `/money/${recipientPerson.id}`,
      },
    },
  });
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
    const occurredAt = value.occurredAt ?? new Date();
    await recordLedgerEverywhere({
      userId: id,
      person,
      direction: value.direction,
      amount: value.amount,
      note: value.note,
      occurredAt,
    });
    // Peer sync is best-effort: recording your own Khata should never fail
    // because the other person has not joined KASA or lacks a profile phone.
    await (async () => {
      try {
        const sender = await db.user.findUnique({
          where: { id },
          select: { name: true, profile: { select: { preferences: true } } },
        });
        await mirrorToKasaContact({
          senderId: id,
          senderName: sender?.name || "Someone",
          senderPhone: profilePhone(sender?.profile?.preferences),
          person,
          direction: value.direction,
          amount: value.amount,
          note: value.note,
          occurredAt,
        });
      } catch {
        // The in-app record is already saved; retry is safe on a later entry.
      }
    })();
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
