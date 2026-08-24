import { apiFetch } from "@/lib/api-client";

export type LearningLesson = {
  id: string;
  title: string;
  position: number;
  completedAt: string | null;
};
export type LearningSession = {
  id: string;
  minutes: number;
  note: string | null;
  studiedAt: string;
};
export type LearningTrack = {
  id: string;
  title: string;
  type: "COURSE" | "BOOK" | "SKILL" | "PRACTICE" | "CERTIFICATION";
  provider: string | null;
  url: string | null;
  description: string | null;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
  weeklyGoalMinutes: number;
  lastStudiedAt: string | null;
  lessons: LearningLesson[];
  sessions: LearningSession[];
  weeklyMinutes: number;
};
export type LearningWorkspace = { tracks: LearningTrack[] };

async function request<T>(method: "GET" | "POST" | "PATCH", body?: unknown) {
  const result = await apiFetch<T>(
    "/api/learning",
    method === "GET" ? {} : { method, body },
  );
  if (!result.data)
    throw new Error(result.error?.message || "Learning is unavailable");
  return result.data;
}
export const getLearning = () => request<LearningWorkspace>("GET");
export const createLearningTrack = (input: {
  title: string;
  type: LearningTrack["type"];
  provider?: string;
  weeklyGoalMinutes: number;
  lessons: string[];
}) => request<{ track: LearningTrack }>("POST", input);
export const updateLearning = (
  input:
    | { trackId: string; action: "log-session"; minutes: number; note?: string }
    | {
        trackId: string;
        action: "toggle-lesson";
        lessonId: string;
        completed: boolean;
      }
    | {
        trackId: string;
        action: "set-status";
        status: LearningTrack["status"];
      },
) => request<LearningWorkspace>("PATCH", input);
