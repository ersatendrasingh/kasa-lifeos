import {
  getCalendar,
  listAutomationEvents,
  listTimelineEvents,
  type AutomationEvent,
  type CalendarChecklist,
  type CalendarItem,
} from "@/lib/automation";
import { listVaultDocuments, type VaultDocument } from "@/lib/documents";
import { listHealthEntries, type HealthEntry } from "@/lib/health";
import {
  listResponsibilities,
  type Responsibility,
} from "@/lib/responsibilities";

const DAY = 86_400_000;
const WATER_GOAL = 3_000;
const SLEEP_GOAL = 8;
const STEPS_GOAL = 8_000;

export type OverviewLink =
  | "/calendar"
  | "/health"
  | "/life-vault"
  | "/responsibilities"
  | "/inbox"
  | "/timeline";

export type OverviewItem = {
  id: string;
  title: string;
  detail: string;
  icon: string;
  href: OverviewLink;
  done?: boolean;
  date?: string;
  action?: string;
};

export type OverviewArea = {
  id: string;
  label: string;
  value: string;
  detail: string;
  icon: string;
  href: OverviewLink;
  score: number | null;
};

export type HealthHighlight = {
  id: "weight" | "bmi" | "bodyFat";
  label: string;
  value: string;
  detail: string;
  icon: string;
  hasValue: boolean;
};

export type LifeOverview = {
  score: number | null;
  streak: number;
  scoreMessage: string;
  completedFocus: number;
  focus: OverviewItem[];
  attention: OverviewItem[];
  upcoming: OverviewItem | null;
  areas: OverviewArea[];
  healthHighlights: HealthHighlight[];
  onTrackAreas: number;
  trackedAreas: number;
};

const dayKey = (value: string | number | Date) =>
  new Date(value).toLocaleDateString("en-CA");

const clampScore = (value: number) => Math.max(0, Math.min(100, value));

function healthScore(entries: HealthEntry[], now: Date) {
  const today = entries.filter(
    (entry) => dayKey(entry.recordedAt) === dayKey(now),
  );
  const total = (type: HealthEntry["type"]) =>
    today
      .filter((entry) => entry.type === type)
      .reduce((sum, entry) => sum + entry.value, 0);
  const water = total("water");
  const steps = total("steps");
  const medicine = total("medicine");
  const sleep = entries.find((entry) => entry.type === "sleep")?.value ?? 0;
  const parts = [
    water ? Math.min(water / WATER_GOAL, 1) : null,
    sleep ? Math.min(sleep / SLEEP_GOAL, 1) : null,
    steps ? Math.min(steps / STEPS_GOAL, 1) : null,
    medicine ? 1 : null,
  ].filter((part): part is number => part !== null);
  return parts.length
    ? Math.round(
        (parts.reduce((sum, part) => sum + part, 0) / parts.length) * 100,
      )
    : null;
}

function latestHealthEntry(entries: HealthEntry[], type: HealthEntry["type"]) {
  return entries
    .filter((entry) => entry.type === type)
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    )[0];
}

function healthHighlights(entries: HealthEntry[]): HealthHighlight[] {
  const makeHighlight = (
    id: HealthHighlight["id"],
    label: string,
    icon: string,
    unit: string,
  ): HealthHighlight => {
    const entry = latestHealthEntry(entries, id);
    if (!entry) {
      return {
        id,
        label,
        value: "Add reading",
        detail: "Tap to log your first value",
        icon,
        hasValue: false,
      };
    }
    const source = entry.source === "smart-scale" ? "Connected scale" : "Manual entry";
    return {
      id,
      label,
      value: `${Number(entry.value.toFixed(1))}${unit}`,
      detail: `${source} · ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(entry.recordedAt))}`,
      icon,
      hasValue: true,
    };
  };

  return [
    makeHighlight("weight", "Weight", "scalemass.fill", " kg"),
    makeHighlight("bmi", "BMI", "figure", ""),
    makeHighlight("bodyFat", "Body fat", "percent", "%"),
  ];
}

function formatDue(value: string, now: Date) {
  const due = new Date(value);
  const days = Math.ceil((due.getTime() - now.getTime()) / DAY);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

function responsibilityScore(items: Responsibility[], now: Date) {
  if (!items.length) return null;
  const overdue = items.filter((item) => new Date(item.nextDueAt) < now).length;
  return clampScore(
    Math.round(((items.length - overdue) / items.length) * 100),
  );
}

function documentScore(items: VaultDocument[], now: Date) {
  const expiring = items.filter((item) => item.expiresAt);
  if (!expiring.length) return items.length ? 100 : null;
  const valid = expiring.filter(
    (item) => new Date(item.expiresAt!) >= now,
  ).length;
  return clampScore(Math.round((valid / expiring.length) * 100));
}

function automationScore(events: AutomationEvent[]) {
  if (!events.length) return null;
  const handled = events.filter((event) =>
    ["ACTIONED", "IGNORED"].includes(event.status),
  ).length;
  return clampScore(Math.round((handled / events.length) * 100));
}

function activityStreak(
  health: HealthEntry[],
  automation: AutomationEvent[],
  timelineDates: string[],
  now: Date,
) {
  const activeDays = new Set([
    ...health.map((entry) => dayKey(entry.recordedAt)),
    ...automation.map((event) => dayKey(event.occurredAt)),
    ...timelineDates.map(dayKey),
  ]);
  let streak = 0;
  const cursor = new Date(now);
  while (activeDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function buildFocus(
  calendarItems: CalendarItem[],
  checklists: CalendarChecklist[],
  events: AutomationEvent[],
  responsibilities: Responsibility[],
  now: Date,
) {
  const today = dayKey(now);
  const calendarFocus: OverviewItem[] = calendarItems
    .filter((item) => item.type === "TASK" && dayKey(item.date) === today)
    .map((item) => ({
      id: `calendar-${item.id}`,
      title: item.title,
      detail: item.detail || "Calendar task · due today",
      icon: "checklist",
      href: "/calendar",
      done: false,
      date: item.date,
    }));
  const checklistFocus: OverviewItem[] = checklists.flatMap((checklist) =>
    checklist.items
      .filter((item) => !item.completedAt)
      .map((item) => ({
        id: `checklist-${item.id}`,
        title: item.title,
        detail: `${checklist.title} checklist`,
        icon: "checklist",
        href: "/calendar" as const,
        done: false,
      })),
  );
  const actionFocus: OverviewItem[] = events.flatMap((event) =>
    event.actions
      .filter(
        (action) =>
          ["PROPOSED", "NEEDS_REVIEW"].includes(action.status) &&
          [
            "CREATE_TASK",
            "CREATE_REMINDER",
            "CREATE_CALENDAR_EVENT",
            "CREATE_CHECKLIST",
          ].includes(action.type),
      )
      .map((action) => ({
        id: `action-${action.id}`,
        title: action.title,
        detail: "Review before adding to your plan",
        icon: "sparkles",
        href: "/inbox" as const,
        done: false,
        date: event.occurredAt,
      })),
  );
  const dueFocus: OverviewItem[] = responsibilities
    .filter((item) => new Date(item.nextDueAt).getTime() <= now.getTime() + DAY)
    .map((item) => ({
      id: `responsibility-${item.id}`,
      title: item.title,
      detail: formatDue(item.nextDueAt, now),
      icon: "bell.badge.fill",
      href: "/responsibilities",
      done: false,
      date: item.nextDueAt,
    }));
  const seen = new Set<string>();
  return [...dueFocus, ...calendarFocus, ...checklistFocus, ...actionFocus]
    .filter((item) => {
      const key = item.title.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function buildAttention(
  events: AutomationEvent[],
  responsibilities: Responsibility[],
  documents: VaultDocument[],
  now: Date,
) {
  const pending: OverviewItem[] = events.flatMap((event) =>
    event.actions
      .filter((action) => ["PROPOSED", "NEEDS_REVIEW"].includes(action.status))
      .map((action) => ({
        id: `attention-${action.id}`,
        title: action.title,
        detail: "Waiting for your review",
        icon: "sparkles",
        href: "/inbox" as const,
        action: "Review",
        date: event.occurredAt,
      })),
  );
  const due = responsibilities
    .filter(
      (item) => new Date(item.nextDueAt).getTime() <= now.getTime() + 7 * DAY,
    )
    .map((item) => ({
      id: `attention-${item.id}`,
      title: item.title,
      detail: formatDue(item.nextDueAt, now),
      icon: "bell.badge.fill",
      href: "/responsibilities" as const,
      action: "Open",
      date: item.nextDueAt,
    }));
  const expiry = documents
    .filter(
      (item) =>
        item.expiresAt &&
        new Date(item.expiresAt).getTime() <= now.getTime() + 30 * DAY,
    )
    .map((item) => ({
      id: `attention-${item.id}`,
      title: item.title,
      detail: item.expiresAt
        ? formatDue(item.expiresAt, now)
        : "Expiry pending",
      icon: "doc.text.fill",
      href: "/life-vault" as const,
      action: "Review",
      date: item.expiresAt ?? undefined,
    }));
  return [...pending, ...due, ...expiry].slice(0, 5);
}

function buildUpcoming(
  calendarItems: CalendarItem[],
  responsibilities: Responsibility[],
  documents: VaultDocument[],
  now: Date,
) {
  const choices: OverviewItem[] = [
    ...calendarItems.map((item) => ({
      id: `upcoming-${item.id}`,
      title: item.title,
      detail: item.detail || "Calendar",
      icon: "calendar",
      href: "/calendar" as const,
      date: item.date,
    })),
    ...responsibilities.map((item) => ({
      id: `upcoming-${item.id}`,
      title: item.title,
      detail: formatDue(item.nextDueAt, now),
      icon: "bell.fill",
      href: "/responsibilities" as const,
      date: item.nextDueAt,
    })),
    ...documents
      .filter((item) => item.expiresAt)
      .map((item) => ({
        id: `upcoming-${item.id}`,
        title: item.title,
        detail: "Document expiry",
        icon: "doc.text.fill",
        href: "/life-vault" as const,
        date: item.expiresAt!,
      })),
  ].filter((item) => item.date && new Date(item.date) >= now);
  return (
    choices.sort((a, b) => +new Date(a.date!) - +new Date(b.date!))[0] ?? null
  );
}

export async function loadLifeOverview(
  reference = new Date(),
): Promise<LifeOverview> {
  const [health, responsibilities, documents, automation, timeline, calendar] =
    await Promise.all([
      listHealthEntries(),
      listResponsibilities(),
      listVaultDocuments(),
      listAutomationEvents(),
      listTimelineEvents(),
      getCalendar(reference),
    ]);

  const healthValue = healthScore(health, reference);
  const responsibilityValue = responsibilityScore(responsibilities, reference);
  const vaultValue = documentScore(documents, reference);
  const captureValue = automationScore(automation);
  const calendarValue = calendar.items.length
    ? clampScore(
        Math.round(
          (calendar.items.filter((item) => new Date(item.date) >= reference)
            .length /
            calendar.items.length) *
            100,
        ),
      )
    : null;
  const timelineValue = timeline.events.length ? 100 : null;
  const todayPlans = calendar.items.filter(
    (item) => dayKey(item.date) === dayKey(reference),
  ).length;
  const dueSoon = responsibilities.filter(
    (item) =>
      new Date(item.nextDueAt).getTime() <= reference.getTime() + 7 * DAY,
  ).length;
  const pendingReviews = automation.reduce(
    (count, event) =>
      count +
      event.actions.filter((action) =>
        ["PROPOSED", "NEEDS_REVIEW"].includes(action.status),
      ).length,
    0,
  );
  const expiringSoon = documents.filter(
    (item) =>
      item.expiresAt &&
      new Date(item.expiresAt).getTime() <= reference.getTime() + 30 * DAY,
  ).length;
  const areas: OverviewArea[] = [
    {
      id: "calendar",
      label: "Calendar",
      value: todayPlans ? `${todayPlans} today` : "Clear today",
      detail: calendar.items.length
        ? `${calendar.items.length} this month`
        : "No plans this month",
      icon: "calendar",
      href: "/calendar",
      score: calendarValue,
    },
    {
      id: "vault",
      label: "Life Vault",
      value: expiringSoon
        ? `${expiringSoon} expiring`
        : `${documents.length} saved`,
      detail: documents.length
        ? `${documents.length} document${documents.length === 1 ? "" : "s"}`
        : "No documents yet",
      icon: "folder.fill",
      href: "/life-vault",
      score: vaultValue,
    },
    {
      id: "health",
      label: "Health Hub",
      value: healthValue === null ? "Start today" : `${healthValue}%`,
      detail:
        healthValue === null
          ? "Water, sleep and movement"
          : "Daily health goals",
      icon: "heart.fill",
      href: "/health",
      score: healthValue,
    },
    {
      id: "responsibilities",
      label: "Responsibilities",
      value: dueSoon
        ? `${dueSoon} due soon`
        : `${responsibilities.length} active`,
      detail: responsibilities.length
        ? `${responsibilities.length} active`
        : "Nothing active",
      icon: "house.fill",
      href: "/responsibilities",
      score: responsibilityValue,
    },
    {
      id: "captures",
      label: "Captures",
      value: pendingReviews
        ? `${pendingReviews} to review`
        : `${automation.length} captured`,
      detail: automation.length ? "Recent KASA inputs" : "No captures yet",
      icon: "sparkles",
      href: "/inbox",
      score: captureValue,
    },
    {
      id: "timeline",
      label: "Timeline",
      value: `${timeline.events.length} moments`,
      detail: timeline.events.length
        ? `${timeline.events.length} moments`
        : "No moments yet",
      icon: "clock.fill",
      href: "/timeline",
      score: timelineValue,
    },
  ];
  const scores = areas
    .map((area) => area.score)
    .filter((score): score is number => score !== null);
  const score = scores.length
    ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
    : null;
  const focus = buildFocus(
    calendar.items,
    calendar.checklists,
    automation,
    responsibilities,
    reference,
  );
  const completedFocus = focus.filter((item) => item.done).length;
  const trackedAreas = scores.length;
  const onTrackAreas = scores.filter((value) => value >= 70).length;
  return {
    score,
    streak: activityStreak(
      health,
      automation,
      timeline.events.map((event) => event.occurredAt),
      reference,
    ),
    scoreMessage:
      score === null
        ? "Add your first real signal to start your Life Score."
        : focus.filter((item) => !item.done).length
          ? `${focus.filter((item) => !item.done).length} item${focus.filter((item) => !item.done).length === 1 ? "" : "s"} need your attention today.`
          : "Your tracked areas are clear for today.",
    completedFocus,
    focus,
    attention: buildAttention(
      automation,
      responsibilities,
      documents,
      reference,
    ),
    upcoming: buildUpcoming(
      calendar.items,
      responsibilities,
      documents,
      reference,
    ),
    areas,
    healthHighlights: healthHighlights(health),
    onTrackAreas,
    trackedAreas,
  };
}
