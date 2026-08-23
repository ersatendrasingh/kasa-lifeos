import { apiFetch } from "@/lib/api-client";

export type HealthEntryType =
  | "weight"
  | "height"
  | "bmi"
  | "bloodPressureSystolic"
  | "bloodPressureDiastolic"
  | "bloodSugar"
  | "heartRate"
  | "spo2"
  | "bodyFat"
  | "fatMass"
  | "muscleMass"
  | "musclePercentage"
  | "skeletalMuscleMass"
  | "bodyWaterMass"
  | "bodyWaterPercentage"
  | "fatFreeMass"
  | "leanMass"
  | "visceralFat"
  | "subcutaneousFat"
  | "boneMass"
  | "proteinMass"
  | "proteinPercentage"
  | "basalMetabolism"
  | "bodyAge"
  | "idealWeight"
  | "bodyScore"
  | "impedance"
  | "temperature"
  | "water"
  | "sleep"
  | "steps"
  | "medicine"
  | "standUp"
  | "eyeRest"
  | "breathing"
  | "sunlight"
  | "healthyMeal"
  | "walk"
  | "run"
  | "cycling"
  | "gym"
  | "yoga"
  | "swimming"
  | "meditation"
  | "stretching";

export type HealthEntry = {
  id: string;
  type: HealthEntryType;
  value: number;
  unit: string;
  source: string;
  recordedAt: string;
  metadata: Record<string, unknown> | null;
};

export type HealthEntryInput = {
  type: HealthEntryType;
  value: number;
  unit: string;
  recordedAt: string;
  metadata?: Record<string, string | number | boolean>;
  source?: "manual" | "smart-scale";
};

export async function listHealthEntries() {
  const response = await apiFetch<{ entries: HealthEntry[] }>("/api/health");
  if (response.error) throw new Error(response.error.message);
  return response.data?.entries ?? [];
}

export async function createHealthEntry(input: HealthEntryInput) {
  const response = await apiFetch<{ entry: HealthEntry }>("/api/health", {
    method: "POST",
    body: input,
  });
  if (response.error) throw new Error(response.error.message);
  if (!response.data?.entry) throw new Error("Could not save this entry.");
  return response.data.entry;
}

export async function createHealthEntries(
  inputs: HealthEntryInput[],
  sessionId: string,
) {
  const response = await apiFetch<{ entries: HealthEntry[] }>("/api/health", {
    method: "POST",
    body: { entries: inputs, sessionId },
  });
  if (response.error) throw new Error(response.error.message);
  if (!response.data?.entries?.length)
    throw new Error("Could not save these scale measurements.");
  return response.data.entries;
}
