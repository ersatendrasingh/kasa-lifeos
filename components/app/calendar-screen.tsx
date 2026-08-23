"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ListTodo,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type CalendarItem = {
  id: string;
  type: "EVENT" | "TASK" | "EXPIRY" | "MOMENT";
  title: string;
  detail: string | null;
  date: string;
  allDay: boolean;
  budgetAmount?: string | null;
  currency?: string | null;
};
type Checklist = {
  id: string;
  title: string;
  items: Array<{ id: string; title: string; completedAt: string | null }>;
};

const tone = {
  EVENT: "bg-brand",
  TASK: "bg-violet-500",
  EXPIRY: "bg-rose-500",
  MOMENT: "bg-emerald-500",
} as const;

const label = {
  EVENT: "Plan",
  TASK: "Task",
  EXPIRY: "Expiry",
  MOMENT: "Memory",
} as const;
const dayKey = (value: Date | string) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function CalendarScreen() {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;
    fetch(`/api/calendar?month=${key}`, { signal: controller.signal })
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("Calendar unavailable")),
      )
      .then((data) => {
        setItems(data.items ?? []);
        setChecklists(data.checklists ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setItems([]);
          setChecklists([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const value = new Date(start);
      value.setDate(start.getDate() + index);
      return value;
    });
  }, [month]);
  const selectedItems = items.filter((item) => dayKey(item.date) === selected);
  const today = dayKey(new Date());
  const visibleChecklists = checklists.filter(
    (checklist) => checklist.items.length,
  );

  return (
    <main className="route-content-enter relative pb-8">
      <div className="pointer-events-none absolute inset-x-0 -top-12 -z-10 h-96 overflow-hidden">
        <div className="ambient-glow absolute top-0 left-1/3 size-96" />
      </div>
      <section className="surface-glass overflow-hidden rounded-[2rem] border p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge
              variant="outline"
              className="border-brand/20 bg-brand-soft/60 text-brand"
            >
              <CalendarDays data-icon="inline-start" /> Your connected time
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">
              Life, on one calendar.
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl leading-6">
              Plans, tasks, document renewals and meaningful moments—shown where
              they are useful. Timely reminders arrive as notifications.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              className="min-w-36 rounded-xl"
              onClick={() => {
                const now = new Date();
                setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelected(dayKey(now));
              }}
            >
              {new Intl.DateTimeFormat("en-IN", {
                month: "long",
                year: "numeric",
              }).format(month)}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="mt-7 grid gap-2 sm:grid-cols-4">
          <p className="text-muted-foreground text-xs">
            <span className="bg-brand mr-1.5 inline-block size-2 rounded-full" />
            Plans
          </p>
          <p className="text-muted-foreground text-xs">
            <span className="mr-1.5 inline-block size-2 rounded-full bg-violet-500" />
            Tasks
          </p>
          <p className="text-muted-foreground text-xs">
            <span className="mr-1.5 inline-block size-2 rounded-full bg-rose-500" />
            Expiries
          </p>
          <p className="text-muted-foreground text-xs">
            <span className="mr-1.5 inline-block size-2 rounded-full bg-emerald-500" />
            Memories
          </p>
        </div>
        <div className="mt-5 overflow-x-auto">
          <div className="min-w-175">
            <div className="grid grid-cols-7 gap-px text-center">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
                <p
                  key={name}
                  className="text-muted-foreground py-2 text-[11px] font-semibold tracking-wider uppercase"
                >
                  {name}
                </p>
              ))}
            </div>
            <div className="bg-border/60 grid grid-cols-7 gap-px overflow-hidden rounded-2xl border">
              {days.map((day) => {
                const key = dayKey(day);
                const entries = items.filter(
                  (item) => dayKey(item.date) === key,
                );
                const currentMonth = day.getMonth() === month.getMonth();
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    className={`bg-card hover:bg-brand-soft/40 min-h-26 p-2 text-left transition ${!currentMonth ? "opacity-35" : ""} ${key === selected ? "ring-brand ring-2 ring-inset" : ""}`}
                  >
                    <span
                      className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${key === today ? "bg-brand text-white" : ""}`}
                    >
                      {day.getDate()}
                    </span>
                    <div className="mt-1 space-y-1">
                      {entries.slice(0, 2).map((entry) => (
                        <span
                          key={entry.id}
                          className="flex items-center gap-1 truncate text-[10px] font-medium"
                        >
                          <i
                            className={`size-1.5 shrink-0 rounded-full ${tone[entry.type]}`}
                          />
                          {entry.title}
                        </span>
                      ))}
                      {entries.length > 2 ? (
                        <span className="text-muted-foreground block text-[10px]">
                          +{entries.length - 2} more
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
        <article className="surface-glass rounded-[1.75rem] border p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-[.12em] uppercase">
                {new Intl.DateTimeFormat("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(new Date(`${selected}T12:00:00`))}
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                What matters that day
              </h2>
            </div>
            <span className="bg-brand-soft text-brand flex size-10 items-center justify-center rounded-xl">
              <Sparkles className="size-4" />
            </span>
          </div>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : selectedItems.length ? (
            <div className="mt-5 space-y-2">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-surface-soft/60 flex gap-3 rounded-2xl p-3"
                >
                  <i
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${tone[item.type]}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {item.title}
                      </p>
                      <Badge variant="secondary" className="text-[10px]">
                        {label[item.type]}
                      </Badge>
                    </div>
                    {item.detail ? (
                      <p className="text-muted-foreground mt-1 text-xs leading-5">
                        {item.detail}
                      </p>
                    ) : null}
                    {item.budgetAmount ? (
                      <p className="text-brand mt-1 text-xs font-semibold">
                        {item.currency ?? "INR"} {item.budgetAmount} budget
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground flex min-h-40 flex-col items-center justify-center text-center">
              <CalendarDays className="mb-3 size-6 opacity-50" />
              <p className="text-sm font-medium">Nothing demanding this day.</p>
              <p className="mt-1 text-xs">
                A little breathing room is part of the plan.
              </p>
            </div>
          )}
        </article>
        <article className="surface-glass rounded-[1.75rem] border p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="bg-positive-soft text-positive flex size-10 items-center justify-center rounded-xl">
              <ListTodo className="size-4" />
            </span>
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-[.12em] uppercase">
                Ready when you are
              </p>
              <h2 className="text-xl font-semibold">Checklists</h2>
            </div>
          </div>
          {visibleChecklists.length ? (
            <div className="mt-5 space-y-4">
              {visibleChecklists.slice(0, 3).map((checklist) => (
                <div key={checklist.id}>
                  <p className="text-sm font-semibold">{checklist.title}</p>
                  <div className="mt-2 space-y-2">
                    {checklist.items.slice(0, 4).map((item) => (
                      <p
                        key={item.id}
                        className="text-muted-foreground flex items-center gap-2 text-xs"
                      >
                        <CircleCheck className="text-positive size-3.5" />
                        {item.title}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground mt-6 text-sm leading-6">
              KASA will put practical lists here when a plan needs more than one
              step.
            </p>
          )}
        </article>
      </section>
    </main>
  );
}
