"use client";
import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpenCheck,
  CircleDollarSign,
  HandCoins,
  Plus,
  ReceiptText,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RouteContentLoader } from "@/components/app/route-content-loader";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
type Person = {
  id: string;
  name: string;
  phone: string | null;
  category: string;
  balance?: number;
};
type Ledger = {
  id: string;
  direction: string;
  amount: number;
  note: string | null;
  occurredAt: string;
  person: { name: string };
};
type Transaction = {
  id: string;
  kind: string;
  title: string;
  amount: number;
  category: string | null;
  occurredAt: string;
};
type MoneyData = {
  people: Person[];
  contacts: Person[];
  ledger: Ledger[];
  transactions: Transaction[];
  automatedExpenses: Transaction[];
  responsibilities: Array<{
    id: string;
    title: string;
    amount: number;
    nextDueAt: string;
    category: string;
  }>;
  summary: { income: number; spend: number };
};
const currency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
const date = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    new Date(value),
  );
export function MoneyWorkspace() {
  const [data, setData] = useState<MoneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<"ledger" | "transaction" | null>(null);
  const [busy, setBusy] = useState(false);
  const [personId, setPersonId] = useState("");
  const [direction, setDirection] = useState("LENT");
  const [kind, setKind] = useState("EXPENSE");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Everyday");
  const [note, setNote] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/money");
        if (!response.ok) throw new Error();
        const payload = await response.json();
        if (!cancelled) setData(payload);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  async function submit() {
    if (
      !amount ||
      (open === "ledger" && !personId) ||
      (open === "transaction" && title.trim().length < 2)
    )
      return;
    setBusy(true);
    try {
      const payload =
        open === "ledger"
          ? {
              action: "ledger",
              personId,
              direction,
              amount: Number(amount),
              note,
            }
          : {
              action: "transaction",
              kind,
              title,
              amount: Number(amount),
              category,
              note,
            };
      const response = await fetch("/api/money", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error();
      setData(await response.json());
      setOpen(null);
      setAmount("");
      setTitle("");
      setNote("");
    } finally {
      setBusy(false);
    }
  }
  const owedToYou =
    data?.contacts
      .filter((person) => (person.balance ?? 0) > 0)
      .reduce((sum, person) => sum + (person.balance ?? 0), 0) ?? 0;
  const youOwe =
    data?.contacts
      .filter((person) => (person.balance ?? 0) < 0)
      .reduce((sum, person) => sum + Math.abs(person.balance ?? 0), 0) ?? 0;
  return (
    <main className="route-content-enter mx-auto max-w-6xl pb-12">
      <header className="border-border/70 flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-positive flex items-center gap-2 text-[.68rem] font-bold tracking-[.18em] uppercase">
            <WalletCards className="size-3.5" /> Private money workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.055em] sm:text-4xl">
            Money, without the guesswork.
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
            Track spending and stay clear on money between you and your people.
            Bank balances are deliberately not collected or inferred here.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="rounded-xl"
            onClick={() => setOpen("transaction")}
          >
            <ReceiptText /> Add cashflow
          </Button>
          <Button className="rounded-xl" onClick={() => setOpen("ledger")}>
            <HandCoins /> New khata entry
          </Button>
        </div>
      </header>
      {loading || !data ? (
        <RouteContentLoader />
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Spent this month"
              value={currency(data.summary.spend)}
              icon={<ArrowUpRight />}
              tone="text-danger bg-danger-soft"
            />
            <Metric
              label="Income logged"
              value={currency(data.summary.income)}
              icon={<ArrowDownLeft />}
              tone="text-positive bg-positive-soft"
            />
            <Metric
              label="To receive"
              value={currency(owedToYou)}
              icon={<HandCoins />}
              tone="text-brand bg-brand-soft"
            />
            <Metric
              label="You owe"
              value={currency(youOwe)}
              icon={<UsersRound />}
              tone="text-warning bg-warning-soft"
            />
          </section>
          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-5">
              <section className="bg-card shadow-card rounded-[1.75rem] border p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs font-bold tracking-[.14em] uppercase">
                      Khata book
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      People & balances
                    </h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setOpen("ledger")}
                  >
                    Add entry <Plus />
                  </Button>
                </div>
                {data.contacts.length ? (
                  <div className="mt-5 divide-y">
                    {data.contacts.map((person) => (
                      <div
                        key={person.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold">{person.name}</p>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {person.phone || "Contact from People"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-semibold ${(person.balance ?? 0) > 0 ? "text-positive" : "text-danger"}`}
                          >
                            {currency(Math.abs(person.balance ?? 0))}
                          </p>
                          <p className="text-muted-foreground text-[.65rem]">
                            {(person.balance ?? 0) > 0
                              ? "to receive"
                              : "you owe"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-surface-soft text-muted-foreground mt-5 rounded-2xl p-5 text-sm">
                    Start with a contact in People, then add money lent,
                    borrowed, received or paid. Every settlement stays visible.
                  </div>
                )}
              </section>
              <section className="bg-card shadow-card rounded-[1.75rem] border p-5 sm:p-6">
                <p className="text-muted-foreground text-xs font-bold tracking-[.14em] uppercase">
                  Recent activity
                </p>
                <h2 className="mt-1 text-xl font-semibold">Your money log</h2>
                <div className="mt-5 space-y-2">
                  {[
                    ...data.ledger.map((item) => ({
                      ...item,
                      label: `${item.direction === "LENT" ? "Lent to" : item.direction === "BORROWED" ? "Borrowed from" : item.direction === "RECEIVED" ? "Received from" : "Paid to"} ${item.person.name}`,
                    })),
                    ...data.transactions.map((item) => ({
                      ...item,
                      label: item.title,
                    })),
                  ]
                    .sort(
                      (a, b) =>
                        new Date(b.occurredAt).getTime() -
                        new Date(a.occurredAt).getTime(),
                    )
                    .slice(0, 8)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="bg-surface-soft/60 flex items-center gap-3 rounded-xl p-3"
                      >
                        <span className="bg-card grid size-8 place-items-center rounded-lg">
                          <CircleDollarSign className="text-brand size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.label}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {date(item.occurredAt)}
                          </p>
                        </div>
                        <span className="text-sm font-semibold">
                          {currency(item.amount)}
                        </span>
                      </div>
                    ))}
                </div>
              </section>
            </div>
            <aside className="space-y-5">
              <section className="bg-foreground text-background rounded-[1.75rem] p-6">
                <BookOpenCheck className="text-positive size-5" />
                <p className="text-background/55 mt-5 text-xs font-bold tracking-[.14em] uppercase">
                  Private by design
                </p>
                <p className="mt-3 text-lg leading-7 font-semibold">
                  KASA keeps your khata clear without accessing your bank or
                  showing an assumed available balance.
                </p>
                <p className="text-background/65 mt-4 text-sm leading-6">
                  That secure connection layer will come separately, only with
                  explicit approval and stronger protection.
                </p>
              </section>
              <section className="bg-card rounded-[1.75rem] border p-5">
                <p className="text-muted-foreground text-xs font-bold tracking-[.14em] uppercase">
                  Upcoming dues
                </p>
                {data.responsibilities.length ? (
                  <div className="mt-4 space-y-3">
                    {data.responsibilities.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="text-muted-foreground text-xs">
                            Due {date(item.nextDueAt)}
                          </p>
                        </div>
                        <span className="text-sm font-semibold">
                          {currency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground mt-3 text-sm leading-6">
                    Add bills or subscriptions in Responsibilities to see them
                    here.
                  </p>
                )}
              </section>
            </aside>
          </section>
        </>
      )}
      <Dialog open={open !== null} onOpenChange={() => setOpen(null)}>
        <DialogContent className="rounded-[1.75rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {open === "ledger" ? "Add khata entry" : "Add cashflow"}
            </DialogTitle>
            <DialogDescription>
              {open === "ledger"
                ? "Choose a saved contact and record what changed."
                : "Manual income and expenses only—this does not access any account."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {open === "ledger" ? (
              <>
                <select
                  value={personId}
                  onChange={(event) => setPersonId(event.target.value)}
                  className="bg-card h-11 rounded-xl border px-3 text-sm"
                >
                  <option value="">Choose a contact</option>
                  {data?.people.map((person) => (
                    <option value={person.id} key={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["LENT", "You gave money"],
                    ["BORROWED", "You took money"],
                    ["RECEIVED", "They paid you"],
                    ["PAID", "You paid them"],
                  ].map(([value, label]) => (
                    <Button
                      type="button"
                      key={value}
                      variant={direction === value ? "default" : "secondary"}
                      className="h-auto rounded-xl py-3 text-left"
                      onClick={() => setDirection(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={kind === "EXPENSE" ? "default" : "secondary"}
                    className="rounded-xl"
                    onClick={() => setKind("EXPENSE")}
                  >
                    Expense
                  </Button>
                  <Button
                    type="button"
                    variant={kind === "INCOME" ? "default" : "secondary"}
                    className="rounded-xl"
                    onClick={() => setKind("INCOME")}
                  >
                    Income
                  </Button>
                </div>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Groceries or Freelance payment"
                  className="h-11 rounded-xl"
                />
                <Input
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Category"
                  className="h-11 rounded-xl"
                />
              </>
            )}
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="Amount in ₹"
              className="h-11 rounded-xl"
            />
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Note (optional)"
              className="min-h-20 rounded-xl"
            />
            <Button
              disabled={busy}
              className="h-12 rounded-xl"
              onClick={() => void submit()}
            >
              {busy ? <Spinner /> : <Plus />} Save entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
function Metric({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <article className="bg-card shadow-card rounded-2xl border p-4">
      <span className={`${tone} grid size-8 place-items-center rounded-xl`}>
        {icon}
      </span>
      <p className="mt-4 text-xl font-semibold tracking-tight">{value}</p>
      <p className="text-muted-foreground mt-1 text-sm">{label}</p>
    </article>
  );
}
