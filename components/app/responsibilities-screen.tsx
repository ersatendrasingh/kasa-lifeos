"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  CircleDollarSign,
  Home,
  Plus,
  Repeat2,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Responsibility = {
  id: string;
  title: string;
  area: string;
  provider: string | null;
  cadence: string;
  nextDueAt: string;
  notificationDays: number[];
  amount: string | null;
};
const areas = [
  "HOME",
  "FINANCE",
  "VEHICLE",
  "HEALTH",
  "FAMILY",
  "DOCUMENTS",
  "SUBSCRIPTIONS",
];

export function ResponsibilitiesScreen() {
  const [items, setItems] = useState<Responsibility[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "Electricity bill",
    provider: "",
    area: "HOME",
    cadence: "MONTHLY",
    dueDate: "",
    notificationDays: [7, 3, 1] as number[],
  });
  useEffect(() => {
    setForm((current) => ({
      ...current,
      dueDate:
        current.dueDate ||
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15)
          .toISOString()
          .slice(0, 10),
    }));
    void load();
  }, []);
  async function load() {
    const res = await fetch("/api/responsibilities");
    if (res.ok) setItems((await res.json()).responsibilities ?? []);
  }
  async function create() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/responsibilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError(
        (await res.json()).error ?? "Could not save this responsibility.",
      );
      setSaving(false);
      return;
    }
    const { responsibility } = await res.json();
    setItems((current) =>
      [...current, responsibility].sort(
        (a, b) => +new Date(a.nextDueAt) - +new Date(b.nextDueAt),
      ),
    );
    setSaving(false);
    setOpen(false);
  }
  async function paid(id: string) {
    const res = await fetch("/api/responsibilities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "paid", id }),
    });
    if (!res.ok) return;
    const { responsibility } = await res.json();
    setItems((current) =>
      current.map((item) => (item.id === id ? responsibility : item)),
    );
  }
  const dueSoon = items.filter(
    (item) => +new Date(item.nextDueAt) - Date.now() < 8 * 86400000,
  ).length;
  return (
    <main className="route-content-enter relative pb-8">
      <section className="surface-glass rounded-[2rem] border p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-brand text-xs font-bold tracking-[.15em] uppercase">
              Recurring, made calm
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">
              Responsibilities, remembered.
            </h1>
            <p className="text-muted-foreground mt-4 leading-7">
              Set a bill, renewal or subscription once. KASA carries its cycle
              forward and only nudges you when action is close.
            </p>
          </div>
          <Button
            size="lg"
            className="rounded-xl"
            onClick={() => setOpen(true)}
          >
            <Plus /> Add responsibility
          </Button>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Active"
            value={String(items.length)}
            icon={<Repeat2 />}
          />
          <Metric
            label="Due this week"
            value={String(dueSoon)}
            icon={<CircleDollarSign />}
          />
          <Metric label="Notifications" value="Useful" icon={<ShieldCheck />} />
        </div>
      </section>
      <section className="surface-glass mt-4 rounded-[2rem] border p-5 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Your responsibilities</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Marking paid automatically creates the next due cycle.
            </p>
          </div>
        </div>
        {items.length ? (
          <div className="mt-5 grid gap-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="bg-card flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center"
              >
                <span className="bg-brand-soft text-brand flex size-11 items-center justify-center rounded-2xl">
                  <Home className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {item.provider ? `${item.provider} · ` : ""}
                    {item.cadence.toLowerCase()} · Due{" "}
                    {new Intl.DateTimeFormat("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(item.nextDueAt))}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Alerts {item.notificationDays.join(", ")} days before
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="rounded-xl"
                  onClick={() => void paid(item.id)}
                >
                  <Check /> Paid
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground mt-8 rounded-2xl border border-dashed p-10 text-center text-sm">
            Add your first responsibility—electricity, rent, EMI, medicine or a
            subscription.
          </div>
        )}
      </section>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="bg-popover w-full max-w-xl rounded-[2rem] border p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-brand text-xs font-bold tracking-[.14em] uppercase">
                  One-time setup
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Add responsibility
                </h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  KASA will create every future due cycle after you mark the
                  current one paid.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                What needs remembering?
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Provider{" "}
                <Input
                  placeholder="BSES, Tata, Netflix…"
                  value={form.provider}
                  onChange={(e) =>
                    setForm({ ...form, provider: e.target.value })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                First due date{" "}
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm({ ...form, dueDate: e.target.value })
                  }
                />
              </label>
              <Choice
                label="Life area"
                value={form.area}
                values={areas}
                onChange={(value) => setForm({ ...form, area: value })}
              />
              <Choice
                label="Repeats"
                value={form.cadence}
                values={["MONTHLY", "QUARTERLY", "YEARLY"]}
                onChange={(value) => setForm({ ...form, cadence: value })}
              />
            </div>
            <p className="text-muted-foreground mt-5 text-xs font-semibold tracking-wide uppercase">
              Notify me
            </p>
            <div className="mt-2 flex gap-2">
              {[7, 3, 1].map((day) => (
                <button
                  key={day}
                  onClick={() =>
                    setForm({
                      ...form,
                      notificationDays: form.notificationDays.includes(day)
                        ? form.notificationDays.filter((item) => item !== day)
                        : [...form.notificationDays, day],
                    })
                  }
                  className={`rounded-xl border px-3 py-2 text-sm font-medium ${form.notificationDays.includes(day) ? "border-brand bg-brand-soft text-brand" : ""}`}
                >
                  {day} days before
                </button>
              ))}
            </div>
            {error && <p className="text-destructive mt-4 text-sm">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void create()} disabled={saving}>
                {saving ? "Saving…" : "Save responsibility"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl border p-4">
      <div className="text-brand bg-brand-soft flex size-9 items-center justify-center rounded-xl [&_svg]:size-4">
        {icon}
      </div>
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="text-muted-foreground mt-1 text-sm">{label}</p>
    </div>
  );
}
function Choice({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-input h-9 rounded-lg border bg-transparent px-2 text-sm"
      >
        {values.map((item) => (
          <option key={item} value={item}>
            {item[0] + item.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
