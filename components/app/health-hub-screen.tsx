"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowDown,
  Bike,
  Check,
  ChevronRight,
  Clock3,
  Droplets,
  Dumbbell,
  Footprints,
  HeartPulse,
  MoonStar,
  Plus,
  Scale,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  Waves,
  type LucideIcon,
} from "lucide-react";

import { createHealthEntryAction } from "@/app/app/health/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { HealthEntryType, HealthEntryView } from "@/lib/health/types";
import { cn } from "@/lib/utils";

type HubSection = "today" | "measurements" | "activities" | "wellness";

const DAY = 86_400_000;
const waterGoal = 3_000;
const stepsGoal = 8_000;
const sleepGoal = 8;

const referenceRanges: Partial<Record<HealthEntryType, string>> = {
  bmi: "Healthy reference: 18.5–24.9",
  bloodSugar: "Fasting reference: 70–99 mg/dL",
  heartRate: "Resting reference: 60–100 bpm",
  spo2: "Reference: 95–100%",
  bodyFat: "Depends on age and sex",
  temperature: "Reference: 36.1–37.2 °C",
  bloodPressureSystolic: "Typical reference: under 120 mmHg",
  bloodPressureDiastolic: "Typical reference: under 80 mmHg",
};

const entryOptions: Array<{
  type: HealthEntryType;
  label: string;
  unit: string;
  placeholder: string;
  group: Exclude<HubSection, "today">;
}> = [
  {
    type: "weight",
    label: "Weight",
    unit: "kg",
    placeholder: "74.2",
    group: "measurements",
  },
  {
    type: "height",
    label: "Height",
    unit: "cm",
    placeholder: "175",
    group: "measurements",
  },
  {
    type: "heartRate",
    label: "Heart rate",
    unit: "bpm",
    placeholder: "72",
    group: "measurements",
  },
  {
    type: "spo2",
    label: "SpO₂",
    unit: "%",
    placeholder: "98",
    group: "measurements",
  },
  {
    type: "bloodSugar",
    label: "Blood sugar",
    unit: "mg/dL",
    placeholder: "95",
    group: "measurements",
  },
  {
    type: "temperature",
    label: "Temperature",
    unit: "°C",
    placeholder: "36.8",
    group: "measurements",
  },
  {
    type: "steps",
    label: "Steps",
    unit: "count",
    placeholder: "6500",
    group: "activities",
  },
  {
    type: "walk",
    label: "Walk",
    unit: "km",
    placeholder: "3.5",
    group: "activities",
  },
  {
    type: "run",
    label: "Run",
    unit: "km",
    placeholder: "5",
    group: "activities",
  },
  {
    type: "cycling",
    label: "Cycling",
    unit: "km",
    placeholder: "12",
    group: "activities",
  },
  {
    type: "gym",
    label: "Gym",
    unit: "min",
    placeholder: "45",
    group: "activities",
  },
  {
    type: "yoga",
    label: "Yoga",
    unit: "min",
    placeholder: "30",
    group: "activities",
  },
  {
    type: "water",
    label: "Water",
    unit: "ml",
    placeholder: "250",
    group: "wellness",
  },
  {
    type: "sleep",
    label: "Sleep",
    unit: "hours",
    placeholder: "7.5",
    group: "wellness",
  },
  {
    type: "medicine",
    label: "Medicine",
    unit: "dose",
    placeholder: "1",
    group: "wellness",
  },
  {
    type: "meditation",
    label: "Meditation",
    unit: "min",
    placeholder: "10",
    group: "wellness",
  },
  {
    type: "stretching",
    label: "Stretching",
    unit: "min",
    placeholder: "10",
    group: "wellness",
  },
];

const catalogue = {
  measurements: [
    "Weight",
    "Height",
    "BMI",
    "Blood pressure",
    "Blood sugar",
    "Heart rate",
    "SpO₂",
    "Body fat",
    "Temperature",
  ],
  activities: [
    "Walk",
    "Run",
    "Cycling",
    "Gym",
    "Yoga",
    "Swimming",
    "Meditation",
    "Stretching",
  ],
  wellness: [
    "Water",
    "Medicine",
    "Sleep",
    "Stand up",
    "Eye rest",
    "Breathing",
    "Sunlight",
    "Healthy meal",
  ],
};

function sameLocalDay(date: Date, reference: Date) {
  return date.toDateString() === reference.toDateString();
}

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
  }).format(value);
}

export function HealthHubScreen({
  initialEntries,
}: {
  initialEntries: HealthEntryView[];
}) {
  const [referenceTime] = useState(() => Date.now());
  const [entries, setEntries] = useState(initialEntries);
  const [section, setSection] = useState<HubSection>("today");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<HealthEntryType>("weight");
  const [value, setValue] = useState("");
  const [medicineName, setMedicineName] = useState("Vitamin D");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const summary = useMemo(() => {
    const referenceDate = new Date(referenceTime);
    const today = entries.filter((entry) =>
      sameLocalDay(new Date(entry.recordedAt), referenceDate),
    );
    const latest = (type: HealthEntryType) =>
      entries.find((entry) => entry.type === type);
    const totalToday = (type: HealthEntryType) =>
      today
        .filter((entry) => entry.type === type)
        .reduce((sum, entry) => sum + entry.value, 0);
    const weight = latest("weight");
    const priorWeight = entries.find(
      (entry) =>
        entry.type === "weight" &&
        weight &&
        entry.id !== weight.id &&
        +new Date(entry.recordedAt) <= +new Date(weight.recordedAt) - 5 * DAY,
    );
    const water = totalToday("water");
    const steps = totalToday("steps");
    const sleep = latest("sleep")?.value ?? 0;
    const medicine = totalToday("medicine") > 0;
    const available = [
      water > 0,
      sleep > 0,
      steps > 0,
      entries.some((entry) => entry.type === "medicine"),
    ];
    const scores = [
      Math.min(water / waterGoal, 1),
      Math.min(sleep / sleepGoal, 1),
      Math.min(steps / stepsGoal, 1),
      medicine ? 1 : 0,
    ];
    const score = available.some(Boolean)
      ? Math.round(
          (scores.reduce(
            (sum, item, index) => sum + (available[index] ? item : 0),
            0,
          ) /
            available.filter(Boolean).length) *
            100,
        )
      : null;
    return {
      water,
      steps,
      sleep,
      medicine,
      weight,
      priorWeight,
      score,
      scores,
    };
  }, [entries, referenceTime]);

  const option =
    entryOptions.find((item) => item.type === selectedType) ?? entryOptions[0];

  function openEntry(type: HealthEntryType) {
    setSelectedType(type);
    setValue("");
    setError("");
    setDialogOpen(true);
  }

  function saveEntry(type = selectedType, quickValue?: number) {
    const chosen = entryOptions.find((item) => item.type === type) ?? option;
    const parsedValue = quickValue ?? Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      setError("Enter a value greater than zero.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await createHealthEntryAction({
        type,
        value: parsedValue,
        unit: chosen.unit,
        recordedAt: new Date(),
        metadata:
          type === "medicine"
            ? { name: medicineName, completed: true }
            : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEntries((current) => [result.entry, ...current]);
      setDialogOpen(false);
    });
  }

  return (
    <main className="route-content-enter relative pb-8">
      <div className="pointer-events-none absolute inset-x-0 -top-8 -z-10 h-72 overflow-hidden">
        <div className="bg-positive/10 absolute top-0 left-[12%] size-72 rounded-full blur-3xl" />
        <div className="bg-info/10 absolute -top-10 right-[6%] size-64 rounded-full blur-3xl" />
      </div>

      <header className="flex flex-col gap-5 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-positive flex items-center gap-2 text-xs font-bold tracking-[0.14em] uppercase">
            <HeartPulse className="size-4" /> Personal wellbeing
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
            Health Hub
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl leading-7">
            Your daily health signals, kept simple. Log what matters and let
            patterns emerge over time.
          </p>
        </div>
        <Button
          size="lg"
          className="shadow-brand h-12 rounded-xl px-5"
          onClick={() => openEntry("weight")}
        >
          <Plus /> Log health
        </Button>
      </header>

      <nav
        className="bg-card/70 shadow-card mt-7 flex gap-1 overflow-x-auto rounded-2xl border p-1.5 backdrop-blur-xl"
        aria-label="Health Hub sections"
      >
        {(["today", "measurements", "activities", "wellness"] as const).map(
          (item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSection(item)}
              className={cn(
                "min-w-fit flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold capitalize transition",
                section === item
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-surface-soft hover:text-foreground",
              )}
            >
              {item === "today" ? "Today" : item}
            </button>
          ),
        )}
      </nav>

      {section === "today" ? (
        <TodayView
          summary={summary}
          entries={entries}
          referenceTime={referenceTime}
          openEntry={openEntry}
          quickWater={(amount) => saveEntry("water", amount)}
          pending={isPending}
        />
      ) : (
        <CategoryView
          section={section}
          entries={entries}
          openEntry={openEntry}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[1.75rem] p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Log a health entry</DialogTitle>
            <DialogDescription>
              Manual today. The same format will accept connected-device data
              later.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid gap-5">
            <label className="grid gap-2 text-sm font-semibold">
              What are you logging?
              <select
                value={selectedType}
                onChange={(event) => {
                  setSelectedType(event.target.value as HealthEntryType);
                  setValue("");
                }}
                className="border-input bg-background focus-visible:ring-ring h-11 rounded-xl border px-3 outline-none focus-visible:ring-2"
              >
                {entryOptions.map((item) => (
                  <option value={item.type} key={item.type}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedType === "medicine" && (
              <label className="grid gap-2 text-sm font-semibold">
                Medicine
                <Input
                  value={medicineName}
                  onChange={(event) => setMedicineName(event.target.value)}
                />
              </label>
            )}
            <label className="grid gap-2 text-sm font-semibold">
              {selectedType === "medicine" ? "Doses completed" : option.label}
              <div className="relative">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder={option.placeholder}
                  className="h-12 pr-20 text-lg"
                  autoFocus
                />
                <span className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-sm">
                  {option.unit}
                </span>
              </div>
            </label>
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button
              className="h-12 rounded-xl"
              disabled={isPending}
              onClick={() => saveEntry()}
            >
              {isPending ? "Saving…" : "Save entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

type HealthSummary = {
  water: number;
  steps: number;
  sleep: number;
  medicine: boolean;
  weight?: HealthEntryView;
  priorWeight?: HealthEntryView;
  score: number | null;
  scores: number[];
};

function TodayView({
  summary,
  entries,
  openEntry,
  quickWater,
  pending,
  referenceTime,
}: {
  summary: HealthSummary;
  entries: HealthEntryView[];
  openEntry: (type: HealthEntryType) => void;
  quickWater: (amount: number) => void;
  pending: boolean;
  referenceTime: number;
}) {
  const weightDelta =
    summary.weight && summary.priorWeight
      ? summary.weight.value - summary.priorWeight.value
      : null;
  const weekly = entries.filter(
    (entry) => +new Date(entry.recordedAt) > referenceTime - 7 * DAY,
  );
  const avg = (type: HealthEntryType) => {
    const items = weekly.filter((entry) => entry.type === type);
    return items.length
      ? items.reduce((sum, entry) => sum + entry.value, 0) /
          Math.min(
            7,
            new Set(
              items.map((entry) => new Date(entry.recordedAt).toDateString()),
            ).size || 1,
          )
      : 0;
  };

  return (
    <>
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_0.75fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <TrackerCard
            icon={Droplets}
            tone="text-info bg-info-soft"
            title="Water"
            value={`${formatNumber(summary.water / 1000)} L`}
            detail={`of ${(waterGoal / 1000).toFixed(0)} L goal`}
            progress={(summary.water / waterGoal) * 100}
            onClick={() => openEntry("water")}
          >
            <div className="mt-4 flex gap-2">
              {[250, 500].map((amount) => (
                <Button
                  key={amount}
                  size="sm"
                  variant="secondary"
                  className="flex-1 rounded-xl"
                  disabled={pending}
                  onClick={(event) => {
                    event.stopPropagation();
                    quickWater(amount);
                  }}
                >
                  <Plus /> {amount} ml
                </Button>
              ))}
            </div>
          </TrackerCard>
          <TrackerCard
            icon={Scale}
            tone="text-positive bg-positive-soft"
            title="Weight"
            value={
              summary.weight
                ? `${formatNumber(summary.weight.value)} kg`
                : "Not logged"
            }
            detail={
              weightDelta === null
                ? "Add your first measurement"
                : `${weightDelta <= 0 ? "↓" : "↑"} ${formatNumber(Math.abs(weightDelta))} kg since last week`
            }
            onClick={() => openEntry("weight")}
          >
            {weightDelta !== null && (
              <Badge variant="secondary" className="mt-4">
                <ArrowDown
                  className={cn("size-3.5", weightDelta > 0 && "rotate-180")}
                />{" "}
                {weightDelta <= 0 ? "Trending down" : "Trending up"}
              </Badge>
            )}
          </TrackerCard>
          <TrackerCard
            icon={MoonStar}
            tone="text-info bg-info-soft"
            title="Sleep"
            value={
              summary.sleep
                ? `${Math.floor(summary.sleep)}h ${Math.round((summary.sleep % 1) * 60)}m`
                : "Not logged"
            }
            detail="Last sleep entry"
            progress={(summary.sleep / sleepGoal) * 100}
            onClick={() => openEntry("sleep")}
          />
          <TrackerCard
            icon={Footprints}
            tone="text-warning bg-warning-soft"
            title="Steps"
            value={
              summary.steps ? formatNumber(summary.steps, 0) : "Not logged"
            }
            detail={`of ${formatNumber(stepsGoal, 0)} daily goal`}
            progress={(summary.steps / stepsGoal) * 100}
            onClick={() => openEntry("steps")}
          />
        </div>

        <article className="bg-foreground text-background shadow-card relative overflow-hidden rounded-[2rem] border p-6 sm:p-7">
          <div className="border-background/10 absolute -top-14 -right-14 size-48 rounded-full border" />
          <div className="bg-positive/20 absolute top-1/3 -right-6 size-28 rounded-full blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-background/60 text-xs font-bold tracking-[0.14em] uppercase">
                Health score
              </p>
              <p className="mt-3 text-5xl font-semibold tracking-[-0.06em]">
                {summary.score ?? "—"}
                <span className="text-background/45 text-xl"> / 100</span>
              </p>
            </div>
            <span className="bg-background/10 grid size-11 place-items-center rounded-2xl">
              <HeartPulse className="size-5" />
            </span>
          </div>
          <p className="text-background/65 mt-4 text-sm leading-6">
            {summary.score === null
              ? "Log today’s basics to build your first score."
              : summary.score >= 80
                ? "You’re taking good care of the basics today."
                : "A few gentle wins can lift today’s balance."}
          </p>
          <div className="relative mt-7 grid gap-4">
            {[
              ["Water", summary.scores[0]],
              ["Sleep", summary.scores[1]],
              ["Activity", summary.scores[2]],
              ["Medicine", summary.scores[3]],
            ].map(([label, score]) => (
              <div key={String(label)}>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="text-background/65">{label}</span>
                  <span>{Math.round(Number(score) * 100)}%</span>
                </div>
                <div className="bg-background/15 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-positive h-full rounded-full"
                    style={{ width: `${Math.min(Number(score) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="text-background/55 border-background/10 relative mt-7 flex items-center gap-2 border-t pt-5 text-xs">
            <ShieldCheck className="size-4" /> Wellness insight, never a
            diagnosis
          </div>
        </article>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="surface-glass rounded-[1.75rem] border p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs font-bold tracking-[0.13em] uppercase">
                Wellness coach
              </p>
              <h2 className="mt-2 text-xl font-semibold">One useful nudge</h2>
            </div>
            <span className="bg-brand-soft text-brand grid size-10 place-items-center rounded-2xl">
              <Sparkles className="size-4.5" />
            </span>
          </div>
          <div className="bg-surface-soft mt-5 flex gap-4 rounded-2xl p-4">
            <span className="text-2xl" aria-hidden>
              💧
            </span>
            <div>
              <p className="font-semibold">
                A glass of water would fit well now.
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                {summary.water
                  ? `You’ve logged ${formatNumber(summary.water / 1000)} L today. Your next small step is just 250 ml.`
                  : "You haven’t logged water today. Start with one glass—no pressure."}
              </p>
            </div>
          </div>
          <p className="text-muted-foreground mt-4 flex items-center gap-2 text-xs">
            <Clock3 className="size-4" /> Coach learns your rhythm before
            suggesting a time.
          </p>
        </article>

        <article className="surface-glass rounded-[1.75rem] border p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs font-bold tracking-[0.13em] uppercase">
                Sunday review
              </p>
              <h2 className="mt-2 text-xl font-semibold">This week</h2>
            </div>
            <Badge variant="outline">Last 7 days</Badge>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <ReviewStat
              label="Walk"
              value={
                weekly.some((entry) => entry.type === "walk")
                  ? `${formatNumber(weekly.filter((entry) => entry.type === "walk").reduce((sum, entry) => sum + entry.value, 0))} km`
                  : "—"
              }
            />
            <ReviewStat
              label="Sleep avg"
              value={avg("sleep") ? `${formatNumber(avg("sleep"))} hrs` : "—"}
            />
            <ReviewStat
              label="Water avg"
              value={
                avg("water") ? `${formatNumber(avg("water") / 1000)} L` : "—"
              }
            />
            <ReviewStat
              label="Weight"
              value={
                weightDelta === null
                  ? "—"
                  : `${weightDelta > 0 ? "+" : ""}${formatNumber(weightDelta)} kg`
              }
            />
          </div>
        </article>
      </section>
    </>
  );
}

function TrackerCard({
  icon: Icon,
  tone,
  title,
  value,
  detail,
  progress,
  onClick,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  value: string;
  detail: string;
  progress?: number;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <article className="surface-glass group hover:shadow-card rounded-[1.75rem] border p-5 transition hover:-translate-y-0.5 sm:p-6">
      <div className="flex items-start justify-between">
        <span
          className={cn("grid size-11 place-items-center rounded-2xl", tone)}
        >
          <Icon className="size-5" />
        </span>
        <button
          type="button"
          onClick={onClick}
          aria-label={`Log ${title}`}
          className="text-muted-foreground hover:bg-surface-soft hover:text-foreground grid size-9 place-items-center rounded-xl transition"
        >
          <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
        </button>
      </div>
      <p className="text-muted-foreground mt-5 text-sm font-medium">{title}</p>
      <p className="mt-1 text-3xl font-semibold tracking-[-0.045em]">{value}</p>
      <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
      {progress !== undefined && (
        <Progress value={Math.min(progress, 100)} className="mt-4 h-1.5" />
      )}
      {children}
    </article>
  );
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-soft rounded-2xl p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}

function CategoryView({
  section,
  entries,
  openEntry,
}: {
  section: Exclude<HubSection, "today">;
  entries: HealthEntryView[];
  openEntry: (type: HealthEntryType) => void;
}) {
  const config = {
    measurements: {
      icon: Stethoscope,
      title: "Measurements",
      description: "Numbers that show change over time.",
      tone: "bg-positive-soft text-positive",
    },
    activities: {
      icon: Activity,
      title: "Activities",
      description: "Movement and mindfulness events.",
      tone: "bg-warning-soft text-warning",
    },
    wellness: {
      icon: Sun,
      title: "Wellness",
      description: "Daily care, reminders and behavior.",
      tone: "bg-info-soft text-info",
    },
  }[section];
  const Icon = config.icon;
  const available = entryOptions.filter((item) => item.group === section);
  const recent = entries
    .filter((entry) => available.some((item) => item.type === entry.type))
    .slice(0, 6);
  const decorativeIcons = [
    Scale,
    Footprints,
    Droplets,
    MoonStar,
    Bike,
    Dumbbell,
    Waves,
  ];
  return (
    <section className="mt-4 grid items-start gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <article className="surface-glass rounded-[2rem] border p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span
              className={cn(
                "grid size-11 place-items-center rounded-2xl",
                config.tone,
              )}
            >
              <Icon className="size-5" />
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.035em]">
              {config.title}
            </h2>
            <p className="text-muted-foreground mt-2">{config.description}</p>
          </div>
          <Button
            className="rounded-xl"
            onClick={() => openEntry(available[0].type)}
          >
            <Plus /> Add
          </Button>
        </div>
        <div className="mt-7 grid gap-2 sm:grid-cols-2">
          {catalogue[section].map((label, index) => {
            const match = available.find(
              (item) => item.label.toLowerCase() === label.toLowerCase(),
            );
            const ItemIcon = decorativeIcons[index % decorativeIcons.length];
            const latest = match
              ? entries.find((entry) => entry.type === match.type)
              : undefined;
            return (
              <button
                key={label}
                type="button"
                onClick={() => match && openEntry(match.type)}
                className="group bg-surface-soft hover:border-border hover:bg-card flex items-center gap-3 rounded-2xl border border-transparent p-3.5 text-left transition"
              >
                <span className="bg-card text-muted-foreground grid size-9 place-items-center rounded-xl">
                  <ItemIcon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{label}</span>
                  {latest ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {formatNumber(latest.value)} {latest.unit} · {latest.source === "smart-scale" ? "Scale" : "Manual"}
                    </span>
                  ) : match && referenceRanges[match.type] ? (
                    <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                      {referenceRanges[match.type]}
                    </span>
                  ) : null}
                </span>
                {match ? (
                  <Plus className="text-muted-foreground size-4" />
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Soon
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </article>
      <article className="surface-glass rounded-[2rem] border p-5 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs font-bold tracking-[0.13em] uppercase">
              History
            </p>
            <h2 className="mt-2 text-xl font-semibold">Recent entries</h2>
          </div>
          <Activity className="text-muted-foreground size-5" />
        </div>
        {recent.length ? (
          <div className="divide-border/70 mt-5 divide-y">
            {recent.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 py-4">
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-xl",
                    config.tone,
                  )}
                >
                  <Check className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold capitalize">
                    {entry.type.replace(/([A-Z])/g, " $1")}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Manual entry ·{" "}
                    {new Intl.DateTimeFormat("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(entry.recordedAt))}
                  </p>
                </div>
                <p className="font-semibold">
                  {formatNumber(entry.value)}{" "}
                  <span className="text-muted-foreground text-xs font-normal">
                    {entry.unit}
                  </span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed p-10 text-center">
            <Icon className="text-muted-foreground mx-auto size-6" />
            <p className="mt-3 font-semibold">No entries yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Your history will stay calm and readable here.
            </p>
          </div>
        )}
      </article>
    </section>
  );
}
