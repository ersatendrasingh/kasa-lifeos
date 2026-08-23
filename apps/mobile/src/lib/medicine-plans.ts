import { apiFetch } from "@/lib/api-client";
import { syncLocalNotifications } from "@/lib/notifications";

export type MedicinePlan = {
  id: string;
  name: string;
  dose: string | null;
  times: string[];
  startDate: string;
  endDate: string | null;
  active: boolean;
};

export async function listMedicinePlans() {
  const response = await apiFetch<{ plans: MedicinePlan[] }>("/api/health/medicines");
  if (response.error) throw new Error(response.error.message);
  return response.data?.plans ?? [];
}

export async function createMedicinePlan(input: Omit<MedicinePlan, "id" | "active">) {
  const response = await apiFetch<{ plan: MedicinePlan }>("/api/health/medicines", { method: "POST", body: input });
  if (response.error || !response.data?.plan) throw new Error(response.error?.message || "Could not save this medicine plan.");
  await syncLocalNotifications().catch(() => undefined);
  return response.data.plan;
}
