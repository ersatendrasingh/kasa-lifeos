import { File } from "expo-file-system";

import { apiFetch } from "@/lib/api-client";

export type AutomationAction = {
  id: string;
  type: string;
  title: string;
  status: "PROPOSED" | "NEEDS_REVIEW" | "EXECUTED" | "REJECTED" | "FAILED";
  confidence: number;
  requiresReview: boolean;
};

export type AutomationEvent = {
  id: string;
  source: string;
  rawText: string | null;
  summary: string | null;
  status: "PROCESSING" | "ACTIONED" | "NEEDS_REVIEW" | "IGNORED" | "FAILED";
  confidence: number | null;
  occurredAt: string;
  createdAt: string;
  actions: AutomationAction[];
};

export type AutomationPolicyMode = "REVIEW_FIRST" | "AUTO_SAFE" | "PAUSED";

export type AutomationPolicy = {
  source: string;
  mode: AutomationPolicyMode;
};

export type TimelineEvent = {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  occurredAt: string;
  sourceType: string | null;
};

export type CalendarItem = {
  id: string;
  type:
    "EVENT" | "TASK" | "EXPIRY" | "MOMENT" | "MONEY" | "FESTIVAL" | "BIRTHDAY";
  title: string;
  detail: string | null;
  date: string;
  allDay: boolean;
  meetingUrl?: string | null;
  budgetAmount?: string | null;
  currency?: string | null;
};

export type CalendarChecklist = {
  id: string;
  title: string;
  items: Array<{ id: string; title: string; completedAt: string | null }>;
};

export type AutomationAttachment = {
  id: string;
  eventId: string | null;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  createdAt: string;
  previewUrl: string;
};

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

export async function listAutomationEvents() {
  const response = await apiFetch<{ events: AutomationEvent[] }>(
    "/api/automation/events",
  );
  if (response.error) throw new Error(response.error.message);
  return response.data?.events ?? [];
}

export async function deleteAutomationEvent(id: string) {
  const response = await apiFetch(
    `/api/automation/events?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (response.error) throw new Error(response.error.message);
}

export async function listAutomationAttachments() {
  const response = await apiFetch<{ attachments: AutomationAttachment[] }>(
    "/api/automation/attachments",
  );
  if (response.error) throw new Error(response.error.message);
  return response.data?.attachments ?? [];
}

export async function createAutomationSignal(
  text: string,
  source = "MANUAL_TEXT",
) {
  const response = await apiFetch<{ event: AutomationEvent }>(
    "/api/automation/ingest",
    { method: "POST", body: { text, source } },
  );
  if (response.error) throw new Error(response.error.message);
  if (!response.data?.event)
    throw new Error("KASA did not return an automation event");
  return response.data.event;
}

export async function decideAutomationAction(
  actionId: string,
  decision: "approve" | "reject",
) {
  const response = await apiFetch(`/api/automation/actions/${actionId}`, {
    method: "PATCH",
    body: { decision },
  });
  if (response.error) throw new Error(response.error.message);
}

export async function transcribeVoice(uri: string) {
  const file = new File(uri);
  if (!file.exists || file.size === 0) {
    throw new Error("KASA could not access this recording");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("Keep voice captures under two minutes");
  }
  const fileData = await file.base64();
  const response = await apiFetch<{ text: string; englishText?: string }>(
    "/api/automation/transcribe",
    {
      method: "POST",
      body: {
        fileData,
        fileName: file.name || "kasa-voice.m4a",
        mimeType: file.type || "audio/mp4",
      },
    },
  );
  if (response.error) {
    throw new Error(errorMessage(response.error, "Could not transcribe voice"));
  }
  if (!response.data?.text) throw new Error("No speech was detected");
  return {
    text: response.data.text,
    englishText: response.data.englishText || response.data.text,
  };
}

export async function scanAutomationFile(input: {
  uri: string;
  name: string;
  mimeType: string;
  source: "CAMERA" | "DOCUMENT";
}) {
  const file = new File(input.uri);
  if (!file.exists || file.size === 0) {
    throw new Error("This file is empty or unavailable");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Choose a file under 20 MB");
  }
  const fileData = await file.base64();
  const response = await apiFetch<{ event: AutomationEvent }>(
    "/api/automation/extract",
    {
      method: "POST",
      body: {
        source: input.source,
        fileName: input.name || file.name,
        mimeType: input.mimeType || file.type || "application/octet-stream",
        fileData,
      },
    },
  );
  if (response.error) {
    throw new Error(errorMessage(response.error, "Could not read this file"));
  }
  if (!response.data?.event) throw new Error("KASA did not return a result");
  return response.data.event;
}

export async function getAutomationIntegrations() {
  const response = await apiFetch<{
    connections: Array<{
      provider: string;
      status: string;
      lastSyncAt: string | null;
    }>;
    policies: AutomationPolicy[];
  }>("/api/automation/integrations");
  if (response.error) throw new Error(response.error.message);
  return response.data ?? { connections: [], policies: [] };
}

export async function setAutomationPolicy(
  source: string,
  mode: AutomationPolicyMode,
) {
  const response = await apiFetch("/api/automation/integrations", {
    method: "PATCH",
    body: { source, mode },
  });
  if (response.error) throw new Error(response.error.message);
}

export async function listTimelineEvents(year?: number) {
  const response = await apiFetch<{
    events: TimelineEvent[];
    years: number[];
  }>(`/api/timeline${year ? `?year=${year}` : ""}`);
  if (response.error) throw new Error(response.error.message);
  return response.data ?? { events: [], years: [] };
}

export async function getCalendar(month: Date) {
  const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;
  const response = await apiFetch<{
    items: CalendarItem[];
    checklists: CalendarChecklist[];
  }>(`/api/calendar?month=${key}`);
  if (response.error) throw new Error(response.error.message);
  return response.data ?? { items: [], checklists: [] };
}

export async function saveDeviceBirthdays(month: Date, items: CalendarItem[]) {
  const response = await apiFetch("/api/calendar", {
    method: "POST",
    body: {
      month: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
      birthdays: items.map((item) => ({
        externalId: item.id,
        title: item.title,
        date: item.date,
      })),
    },
  });
  if (response.error) throw new Error(response.error.message);
}

export async function createCalendarEvent(input: {
  title: string;
  kind: "BIRTHDAY" | "PLAN" | "MEETING" | "OTHER";
  startsAt: string;
  durationMinutes: number;
  allDay: boolean;
  notes?: string;
  meetingUrl?: string;
  weekdays: number[];
}) {
  const response = await apiFetch<{ occurrences: number }>("/api/calendar", {
    method: "POST",
    body: { action: "manual-event", ...input },
  });
  if (response.error) throw new Error(response.error.message);
  return response.data;
}

export async function setTimelineEventHidden(id: string, hidden: boolean) {
  const response = await apiFetch("/api/timeline", {
    method: "PATCH",
    body: { id, action: hidden ? "hide" : "restore" },
  });
  if (response.error) throw new Error(response.error.message);
}

export async function deleteTimelineEvent(id: string) {
  const response = await apiFetch(
    `/api/timeline?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
  if (response.error) throw new Error(response.error.message);
}
