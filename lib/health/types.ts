export const healthEntryTypes = [
  "weight",
  "height",
  "bmi",
  "bloodPressureSystolic",
  "bloodPressureDiastolic",
  "bloodSugar",
  "heartRate",
  "spo2",
  "bodyFat",
  "fatMass",
  "muscleMass",
  "musclePercentage",
  "skeletalMuscleMass",
  "bodyWaterMass",
  "bodyWaterPercentage",
  "fatFreeMass",
  "leanMass",
  "visceralFat",
  "subcutaneousFat",
  "boneMass",
  "proteinMass",
  "proteinPercentage",
  "basalMetabolism",
  "bodyAge",
  "idealWeight",
  "bodyScore",
  "impedance",
  "temperature",
  "water",
  "sleep",
  "steps",
  "medicine",
  "standUp",
  "eyeRest",
  "breathing",
  "sunlight",
  "healthyMeal",
  "walk",
  "run",
  "cycling",
  "gym",
  "yoga",
  "swimming",
  "meditation",
  "stretching",
] as const;

export type HealthEntryType = (typeof healthEntryTypes)[number];

export type HealthSourceId =
  | "manual"
  | "apple-health"
  | "google-fit"
  | "samsung-health"
  | "fitbit"
  | "garmin"
  | "smart-scale";

export type NormalizedHealthEntry = {
  type: HealthEntryType;
  value: number;
  unit: string;
  source: HealthSourceId;
  recordedAt: Date;
  metadata?: Record<string, string | number | boolean>;
};

export interface HealthSourceConnector {
  readonly source: Exclude<HealthSourceId, "manual">;
  requestPermission(): Promise<boolean>;
  read(since: Date): Promise<NormalizedHealthEntry[]>;
}

export type HealthEntryView = {
  id: string;
  type: HealthEntryType;
  value: number;
  unit: string;
  source: string;
  recordedAt: string;
  metadata: Record<string, unknown> | null;
};
