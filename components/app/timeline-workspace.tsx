"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  EyeOff,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { RouteContentLoader } from "@/components/app/route-content-loader";

type Event = {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  occurredAt: string;
  sourceType: string | null;
  metadata: unknown;
};
type TimelineResponse = { events: Event[]; years: number[] };

const fullDate = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const monthOnly = new Intl.DateTimeFormat("en-IN", { month: "short" });
const monthLabel = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
});
function eventLabel(type: string) {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function dateParts(date: string) {
  const value = new Date(date);
  return { day: value.getDate(), month: monthOnly.format(value) };
}

export function TimelineWorkspace() {
  const [data, setData] = useState<TimelineResponse>({ events: [], years: [] });
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [selected, setSelected] = useState<Event | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadTimeline() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/timeline${year ? `?year=${year}` : ""}`,
        );
        if (!response.ok) throw new Error("Could not load timeline");
        const payload: TimelineResponse = await response.json();
        if (!cancelled) {
          setData(payload);
          setSelected((current) =>
            current && payload.events.some((item) => item.id === current.id)
              ? current
              : null,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [year]);
  async function hide(id: string) {
    setBusy(id);
    try {
      const response = await fetch("/api/timeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "hide" }),
      });
      if (!response.ok) throw new Error("Could not hide moment");
      setData((current) => ({
        ...current,
        events: current.events.filter((item) => item.id !== id),
      }));
      setSelected((current) => (current?.id === id ? null : current));
    } finally {
      setBusy(null);
    }
  }

  const types = useMemo(
    () => [...new Set(data.events.map((event) => event.type))],
    [data.events],
  );
  const events = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.events.filter(
      (event) =>
        (!needle ||
          `${event.title} ${event.summary ?? ""} ${event.type}`
            .toLowerCase()
            .includes(needle)) &&
        (!type || event.type === type),
    );
  }, [data.events, query, type]);
  const months = useMemo(() => {
    const grouped: { label: string; events: Event[] }[] = [];
    for (const event of events) {
      const label = monthLabel.format(new Date(event.occurredAt));
      const previous = grouped.at(-1);
      if (previous?.label === label) previous.events.push(event);
      else grouped.push({ label, events: [event] });
    }
    return grouped;
  }, [events]);
  const years = data.years.length
    ? data.years
    : [
        ...new Set(
          data.events.map((event) => new Date(event.occurredAt).getFullYear()),
        ),
      ];
  const activeYear = year ?? years[0];

  return (
    <main className="route-content-enter mx-auto max-w-6xl pb-12">
      <header className="border-border/70 flex flex-col justify-between gap-5 border-b pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-brand flex items-center gap-2 text-[.68rem] font-bold tracking-[.18em] uppercase">
            <Sparkles className="size-3.5" /> Life archive
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.055em] sm:text-4xl">
            Your story, in time.
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
            A living record of the moments that shaped your days.
          </p>
        </div>
        <div className="border-border/80 bg-card shadow-card flex items-center gap-3 self-start rounded-2xl border px-4 py-3 sm:self-auto">
          <span className="bg-brand-soft text-brand grid size-8 place-items-center rounded-xl">
            <CalendarDays className="size-4" />
          </span>
          <span>
            <strong className="block text-lg leading-4">{events.length}</strong>
            <span className="text-muted-foreground text-[.68rem]">
              moments shown
            </span>
          </span>
        </div>
      </header>

      <section className="bg-card/80 shadow-card mt-5 rounded-2xl border p-2 backdrop-blur-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your timeline"
              className="h-10 border-0 bg-transparent pl-10 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto px-1 pb-1 lg:pb-0">
            <Button
              size="sm"
              variant={year === null ? "default" : "ghost"}
              className="shrink-0 rounded-lg"
              onClick={() => setYear(null)}
            >
              All time
            </Button>
            {years.slice(0, 5).map((item) => (
              <Button
                key={item}
                size="sm"
                variant={year === item ? "default" : "ghost"}
                className="shrink-0 rounded-lg"
                onClick={() => setYear(item)}
              >
                {item}
              </Button>
            ))}
            <div className="relative shrink-0">
              <select
                aria-label="Choose a year"
                value={year ?? ""}
                onChange={(event) =>
                  setYear(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                className="bg-secondary h-8 appearance-none rounded-lg py-0 pr-7 pl-2.5 text-xs font-semibold outline-none"
              >
                <option value="">More</option>
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-2 right-2 size-3.5" />
            </div>
          </div>
        </div>
      </section>

      {!loading && types.length > 1 && (
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
          <SlidersHorizontal className="text-muted-foreground ml-1 size-3.5 shrink-0" />
          <button
            type="button"
            onClick={() => setType(null)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${!type ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground hover:bg-brand-soft"}`}
          >
            Everything
          </button>
          {types.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setType(item)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${type === item ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground hover:bg-brand-soft"}`}
            >
              {eventLabel(item)}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <RouteContentLoader />
      ) : events.length === 0 ? (
        <EmptyTimeline />
      ) : (
        <>
          <nav
            aria-label="Timeline months"
            className="border-border/70 mt-8 overflow-x-auto border-y py-3"
          >
            <div className="flex min-w-max items-center gap-1 px-1">
              {months.map(({ label, events: monthEvents }) => (
                <a
                  key={label}
                  href={`#${encodeURIComponent(label)}`}
                  className="hover:bg-brand-soft flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition"
                >
                  <span>{label.split(" ")[0]}</span>
                  <span className="bg-muted text-muted-foreground grid size-4 place-items-center rounded-full text-[.6rem]">
                    {monthEvents.length}
                  </span>
                </a>
              ))}
            </div>
          </nav>
          <section className="before:bg-border relative mt-7 pb-4 before:absolute before:top-1 before:bottom-0 before:left-[1.35rem] before:w-px md:before:left-1/2">
            <div className="relative mb-8 flex items-center md:justify-center">
              <span className="bg-foreground text-background rounded-full px-3 py-1 text-[.65rem] font-bold tracking-[.15em] uppercase">
                {activeYear ?? "Archive"}
              </span>
            </div>
            {months.map(({ label, events: monthEvents }) => (
              <section
                key={label}
                id={encodeURIComponent(label)}
                className="relative mb-9 scroll-mt-8"
              >
                <div className="relative z-10 mb-5 flex items-center gap-3 pl-8 md:justify-center md:pl-0">
                  <span className="bg-brand ring-background absolute left-[.77rem] size-3 rounded-full ring-4 md:static" />
                  <h2 className="text-muted-foreground bg-background rounded-full px-2 text-[.68rem] font-bold tracking-[.15em] uppercase">
                    {label}
                  </h2>
                </div>
                <div className="space-y-4">
                  {monthEvents.map((event) => (
                    <TimelineMoment
                      key={event.id}
                      event={event}
                      index={events.findIndex((item) => item.id === event.id)}
                      selected={selected?.id === event.id}
                      onSelect={() => setSelected(event)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </section>
        </>
      )}
      {selected && (
        <MomentDrawer
          event={selected}
          busy={busy === selected.id}
          onClose={() => setSelected(null)}
          onHide={() => void hide(selected.id)}
        />
      )}
    </main>
  );
}

function TimelineMoment({
  event,
  index,
  selected,
  onSelect,
}: {
  event: Event;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const date = dateParts(event.occurredAt);
  const right = index % 2 === 1;
  return (
    <article className="relative grid grid-cols-[2.7rem_minmax(0,1fr)] items-center gap-2 md:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] md:gap-0">
      <time
        className={`text-muted-foreground hidden text-right text-xs font-semibold tabular-nums md:block ${right ? "col-start-1" : "col-start-3"}`}
      >
        {date.day} {date.month}
      </time>
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Open ${event.title}`}
        className="bg-background border-brand text-brand focus-visible:ring-ring relative z-10 col-start-1 row-start-1 grid size-7 place-items-center rounded-full border-2 text-[.62rem] font-bold transition hover:scale-110 focus-visible:ring-2 md:col-start-2"
      >
        <span>{date.day}</span>
      </button>
      <button
        type="button"
        onClick={onSelect}
        className={`group border-border/80 bg-card hover:border-brand/40 hover:shadow-card col-start-2 row-start-1 min-w-0 rounded-2xl border p-4 text-left transition md:row-auto md:max-w-md ${right ? "md:col-start-3 md:ml-6" : "md:col-start-1 md:mr-6"} ${selected ? "border-brand bg-brand-soft/30 shadow-card" : ""}`}
      >
        <div className="flex items-start gap-3">
          <span className="bg-brand-soft text-brand grid size-8 shrink-0 place-items-center rounded-xl text-[.62rem] font-bold">
            {date.month}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-2">
              <span className="truncate text-sm font-semibold">
                {event.title}
              </span>
              <ArrowUpRight className="text-muted-foreground size-4 shrink-0 opacity-0 transition group-hover:opacity-100" />
            </span>
            <span className="text-muted-foreground mt-1 block text-[.68rem] font-semibold tracking-[.08em] uppercase">
              {eventLabel(event.type)}
            </span>
            {event.summary && (
              <span className="text-muted-foreground mt-2 line-clamp-2 block text-xs leading-5">
                {event.summary}
              </span>
            )}
          </span>
        </div>
      </button>
    </article>
  );
}

function MomentDrawer({
  event,
  busy,
  onClose,
  onHide,
}: {
  event: Event;
  busy: boolean;
  onClose: () => void;
  onHide: () => void;
}) {
  return (
    <aside
      className="bg-card shadow-float fixed right-3 bottom-3 left-3 z-50 rounded-[1.75rem] border p-5 sm:right-6 sm:bottom-6 sm:left-auto sm:w-full sm:max-w-md sm:p-6"
      role="dialog"
      aria-modal="false"
      aria-label="Moment details"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-brand text-[.68rem] font-bold tracking-[.15em] uppercase">
            {fullDate.format(new Date(event.occurredAt))}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {event.title}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onClick={onClose}
          aria-label="Close details"
        >
          <X />
        </Button>
      </div>
      <Badge variant="secondary" className="mt-4 rounded-full">
        {eventLabel(event.type)}
      </Badge>
      <p className="text-muted-foreground mt-5 text-sm leading-7">
        {event.summary || "No additional notes were added to this moment."}
      </p>
      <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" className="rounded-xl" onClick={onClose}>
          Done
        </Button>
        <Button
          variant="secondary"
          className="rounded-xl"
          disabled={busy}
          onClick={onHide}
        >
          {busy ? <Spinner /> : <EyeOff />} Hide from timeline
        </Button>
      </div>
    </aside>
  );
}
function EmptyTimeline() {
  return (
    <div className="bg-card/65 mt-8 grid min-h-72 place-items-center rounded-[2rem] border border-dashed p-8 text-center">
      <div>
        <span className="bg-brand-soft text-brand mx-auto grid size-12 place-items-center rounded-2xl">
          <Sparkles className="size-5" />
        </span>
        <h2 className="mt-4 text-xl font-semibold">Nothing here yet</h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
          Try another year or filter, or let new moments build your life
          archive.
        </p>
      </div>
    </div>
  );
}
