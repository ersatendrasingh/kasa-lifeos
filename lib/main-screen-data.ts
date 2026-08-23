export type FocusItem = {
  id: string;
  title: string;
  detail?: string;
  status: "done" | "pending";
  kind: "habit" | "event" | "task";
};

export type MainScreenData = {
  user: {
    firstName?: string;
    initials: string;
    timezone: string;
  };
  greeting: "Good Morning" | "Good Afternoon" | "Good Evening";
  dateLabel: string;
  score: number;
  streakDays: number;
  focusItems: FocusItem[];
};

type UserIdentity = {
  name?: string | null;
};

function getGreeting(hour: number): MainScreenData["greeting"] {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function getInitials(name?: string | null) {
  if (!name) return "K";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export async function getMainScreenData(
  identity?: UserIdentity,
): Promise<MainScreenData> {
  // This timezone will come from the user's persisted profile once onboarding
  // is connected. Keeping it in the data layer prevents UI hard-coding.
  const timezone = "Asia/Kolkata";
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: timezone,
    }).format(now),
  );
  const firstName = identity?.name?.trim().split(/\s+/)[0] || undefined;

  return {
    user: {
      firstName,
      initials: getInitials(identity?.name),
      timezone,
    },
    greeting: getGreeting(hour),
    dateLabel: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: timezone,
    }).format(now),
    score: 82,
    streakDays: 15,
    focusItems: [
      {
        id: "water",
        title: "Drink Water",
        detail: "6 of 8 glasses",
        status: "done",
        kind: "habit",
      },
      {
        id: "standup",
        title: "Office Standup",
        detail: "Completed at 10:15 AM",
        status: "done",
        kind: "event",
      },
      {
        id: "electricity-bill",
        title: "Electricity Bill",
        detail: "Due today",
        status: "pending",
        kind: "task",
      },
      {
        id: "call-parents",
        title: "Call Parents",
        detail: "Evening",
        status: "pending",
        kind: "task",
      },
      {
        id: "walk",
        title: "Walk 30 min",
        detail: "Health goal",
        status: "pending",
        kind: "habit",
      },
    ],
  };
}
