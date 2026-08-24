"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  HeartPulse,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { RouteContentLoader } from "@/components/app/route-content-loader";

type Notification = {
  id: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  readAt: string | null;
  metadata: unknown;
  createdAt: string;
};
type NotificationsResponse = {
  notifications: Notification[];
  unreadCount: number;
};
type Filter = "all" | "unread" | "read";

function relativeDate(value: string) {
  const timestamp = new Date(value).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 10_080) return `${Math.floor(minutes / 1_440)}d ago`;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function notificationKind(notification: Notification) {
  const metadata = notification.metadata;
  const category =
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    "category" in metadata
      ? String(metadata.category)
      : "";
  const searchable =
    `${category} ${notification.title} ${notification.body}`.toLowerCase();
  if (searchable.includes("health") || searchable.includes("medicine"))
    return {
      label: "Health",
      icon: HeartPulse,
      tone: "bg-danger-soft text-danger",
    };
  if (searchable.includes("document") || searchable.includes("expiry"))
    return {
      label: "Documents",
      icon: FileText,
      tone: "bg-info-soft text-info",
    };
  if (
    searchable.includes("renew") ||
    searchable.includes("payment") ||
    searchable.includes("bill")
  )
    return {
      label: "Reminder",
      icon: RefreshCw,
      tone: "bg-warning-soft text-warning",
    };
  return { label: "KASA", icon: BellRing, tone: "bg-brand-soft text-brand" };
}

export function NotificationsWorkspace() {
  const [data, setData] = useState<NotificationsResponse>({
    notifications: [],
    unreadCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadNotifications() {
      setLoading(true);
      try {
        const response = await fetch("/api/notifications");
        if (!response.ok) throw new Error("Could not load notifications");
        const payload: NotificationsResponse = await response.json();
        if (!cancelled) setData(payload);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadNotifications();
    return () => {
      cancelled = true;
    };
  }, []);
  async function updateRead(notification: Notification, read: boolean) {
    setBusy(notification.id);
    try {
      const response = await fetch(`/api/notifications/${notification.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read }),
      });
      if (!response.ok) throw new Error("Could not update notification");
      setData((current) => ({
        ...current,
        notifications: current.notifications.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                readAt: read ? new Date().toISOString() : null,
                status: read
                  ? "READ"
                  : item.status === "READ"
                    ? "SENT"
                    : item.status,
              }
            : item,
        ),
        unreadCount: Math.max(0, current.unreadCount + (read ? -1 : 1)),
      }));
    } finally {
      setBusy(null);
    }
  }
  async function markAllRead() {
    setBusy("all");
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read-all" }),
      });
      if (!response.ok) throw new Error("Could not mark all as read");
      setData((current) => ({
        ...current,
        unreadCount: 0,
        notifications: current.notifications.map((item) =>
          item.readAt
            ? item
            : { ...item, readAt: new Date().toISOString(), status: "READ" },
        ),
      }));
    } finally {
      setBusy(null);
    }
  }
  async function clearRead() {
    setBusy("clear");
    try {
      const response = await fetch("/api/notifications", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not clear notifications");
      setData((current) => ({
        ...current,
        notifications: current.notifications.filter((item) => !item.readAt),
      }));
    } finally {
      setBusy(null);
    }
  }
  const notifications = useMemo(
    () =>
      data.notifications.filter((item) =>
        filter === "all" || filter === "unread"
          ? !item.readAt
          : Boolean(item.readAt),
      ),
    [data.notifications, filter],
  );

  return (
    <main className="route-content-enter mx-auto max-w-5xl pb-12">
      <header className="border-border/70 flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-brand flex items-center gap-2 text-[.68rem] font-bold tracking-[.18em] uppercase">
            <BellRing className="size-3.5" /> Notification center
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.055em] sm:text-4xl">
            What needs your attention.
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
            Reminders, updates and the small nudges that keep life moving.
          </p>
        </div>
        <div className="bg-card shadow-card flex items-center gap-3 self-start rounded-2xl border px-4 py-3 sm:self-auto">
          <span className="bg-brand-soft text-brand grid size-9 place-items-center rounded-xl">
            <Bell className="size-4" />
          </span>
          <span>
            <strong className="block text-lg leading-4">
              {data.unreadCount}
            </strong>
            <span className="text-muted-foreground text-[.68rem]">
              unread alerts
            </span>
          </span>
        </div>
      </header>
      <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="bg-secondary flex w-fit items-center gap-1 rounded-xl p-1">
          {(["all", "unread", "read"] as Filter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${filter === item ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {item}
              {item === "unread" && data.unreadCount
                ? ` (${data.unreadCount})`
                : ""}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl"
            disabled={!data.unreadCount || busy !== null}
            onClick={() => void markAllRead()}
          >
            {busy === "all" ? <Spinner /> : <CheckCheck />} Mark all read
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl"
            disabled={
              !data.notifications.some((item) => item.readAt) || busy !== null
            }
            onClick={() => void clearRead()}
          >
            {busy === "clear" ? <Spinner /> : <Trash2 />} Clear read
          </Button>
        </div>
      </section>
      {loading ? (
        <RouteContentLoader />
      ) : notifications.length ? (
        <section className="bg-card shadow-card mt-5 overflow-hidden rounded-[1.5rem] border">
          {notifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              busy={busy === notification.id}
              onToggle={() =>
                void updateRead(notification, !notification.readAt)
              }
            />
          ))}
        </section>
      ) : (
        <EmptyState filter={filter} />
      )}
    </main>
  );
}

function NotificationRow({
  notification,
  busy,
  onToggle,
}: {
  notification: Notification;
  busy: boolean;
  onToggle: () => void;
}) {
  const kind = notificationKind(notification);
  const Icon = kind.icon;
  const unread = !notification.readAt;
  return (
    <article
      className={`group flex gap-3 border-b p-4 last:border-b-0 sm:gap-4 sm:p-5 ${unread ? "bg-brand-soft/20" : ""}`}
    >
      <span
        className={`${kind.tone} grid size-10 shrink-0 place-items-center rounded-xl`}
      >
        <Icon className="size-4" />
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className={`truncate text-sm ${unread ? "font-semibold" : "font-medium"}`}
              >
                {notification.title}
              </p>
              {unread && (
                <span className="bg-brand size-1.5 shrink-0 rounded-full" />
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {notification.body}
            </p>
            <div className="text-muted-foreground mt-2 flex items-center gap-2 text-[.68rem] font-medium">
              <span className="flex items-center gap-1">
                <Clock3 className="size-3" />
                {relativeDate(notification.sentAt ?? notification.scheduledAt)}
              </span>
              <span className="bg-border size-1 rounded-full" />
              {kind.label}
            </div>
          </div>
          <span className="text-muted-foreground group-hover:bg-secondary mt-1 grid size-7 place-items-center rounded-full transition">
            {busy ? (
              <Spinner className="size-3.5" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </span>
        </div>
      </button>
    </article>
  );
}
function EmptyState({ filter }: { filter: Filter }) {
  const unread = filter === "unread";
  return (
    <div className="bg-card/65 mt-6 grid min-h-72 place-items-center rounded-[2rem] border border-dashed p-8 text-center">
      <div>
        <span className="bg-brand-soft text-brand mx-auto grid size-12 place-items-center rounded-2xl">
          {unread ? (
            <CheckCheck className="size-5" />
          ) : (
            <CircleAlert className="size-5" />
          )}
        </span>
        <h2 className="mt-4 text-xl font-semibold">
          {unread ? "You’re all caught up" : "No notifications here"}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
          {unread
            ? "There’s nothing waiting for your attention right now."
            : "As KASA notices something useful, it will show up here."}
        </p>
      </div>
    </div>
  );
}
