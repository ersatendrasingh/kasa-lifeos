import type { HealthSourceMeasurement } from "@/lib/health-sources/types";

export type BodyCompositionProfile = {
  biologicalSex: "male" | "female";
  birthday: string;
  heightCm: number;
};

type Metric = Pick<HealthSourceMeasurement, "type" | "value" | "unit">;

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function ageFromBirthday(value: string, now = new Date()) {
  const trimmed = value.trim();
  const parts = trimmed.split(/[./-]/).map(Number);
  let birthday: Date;
  if (parts.length === 3 && parts[2] > 999) {
    birthday = new Date(parts[2], parts[1] - 1, parts[0]);
  } else {
    birthday = new Date(trimmed);
  }
  if (Number.isNaN(+birthday) || birthday > now) return null;
  let age = now.getFullYear() - birthday.getFullYear();
  if (
    now.getMonth() < birthday.getMonth() ||
    (now.getMonth() === birthday.getMonth() &&
      now.getDate() < birthday.getDate())
  )
    age -= 1;
  return age >= 10 && age <= 120 ? age : null;
}

export function deriveBodyComposition(
  weightKg: number,
  profile: BodyCompositionProfile,
  measuredImpedance?: number,
): { metrics: Metric[]; impedanceUsed: number; usedFallback: boolean } | null {
  const age = ageFromBirthday(profile.birthday);
  const heightM = profile.heightCm / 100;
  if (
    age === null ||
    !Number.isFinite(weightKg) ||
    weightKg < 5 ||
    weightKg > 300 ||
    !Number.isFinite(heightM) ||
    heightM < 0.8 ||
    heightM > 2.3
  )
    return null;

  // The 526 companion app substitutes 552 Ω whenever its weight packet has no
  // impedance. Preserve that behavior while clearly marking every result as
  // estimated; a real impedance packet always takes precedence.
  const usedFallback = !measuredImpedance || measuredImpedance <= 0;
  const impedanceUsed = usedFallback ? 552 : measuredImpedance;
  const heightCm = profile.heightCm;
  const h2r = (heightCm * heightCm) / impedanceUsed;
  const male = profile.biologicalSex === "male";
  const bmi = weightKg / (heightM * heightM);
  const rawFatFreeMass = male
    ? -10.68 + 0.65 * h2r + 0.26 * weightKg + 0.02 * impedanceUsed
    : -9.53 + 0.69 * h2r + 0.17 * weightKg + 0.02 * impedanceUsed;
  const fatFreeMass = clamp(rawFatFreeMass, weightKg * 0.35, weightKg * 0.97);
  const fatMass = weightKg - fatFreeMass;
  const bodyFat = (fatMass / weightKg) * 100;
  const waterKgRaw =
    0.99513 *
    (male
      ? 1.2 + 0.45 * h2r + 0.18 * weightKg
      : 3.75 + 0.45 * h2r + 0.11 * weightKg);
  const bodyWaterMass = clamp(
    waterKgRaw,
    fatFreeMass * 0.55,
    fatFreeMass * 0.8,
  );
  const bodyWaterPercentage = (bodyWaterMass / weightKg) * 100;
  const skeletalMuscleMass = clamp(
    0.401 * h2r + (male ? 3.825 : 0) - 0.071 * age + 5.102,
    1,
    fatFreeMass,
  );
  const musclePercentage = (skeletalMuscleMass / weightKg) * 100;
  const boneMass = clamp((male ? 0.057 : 0.05) * fatFreeMass, 0.5, 8);
  const proteinMass = clamp(
    fatFreeMass - bodyWaterMass - boneMass,
    0,
    fatFreeMass,
  );
  const proteinPercentage = (proteinMass / weightKg) * 100;
  const muscleMass = clamp(fatFreeMass - boneMass, 0, weightKg);
  const basalMetabolism = clamp(fatFreeMass * 21.6 + 370, 500, 4000);
  const idealWeight = 22 * heightM * heightM;

  return {
    impedanceUsed,
    usedFallback,
    metrics: [
      { type: "bmi", value: round(bmi), unit: "score" },
      { type: "bodyFat", value: round(bodyFat), unit: "%" },
      { type: "fatMass", value: round(fatMass), unit: "kg" },
      { type: "fatFreeMass", value: round(fatFreeMass), unit: "kg" },
      { type: "muscleMass", value: round(muscleMass), unit: "kg" },
      {
        type: "skeletalMuscleMass",
        value: round(skeletalMuscleMass),
        unit: "kg",
      },
      {
        type: "musclePercentage",
        value: round(musclePercentage),
        unit: "%",
      },
      {
        type: "bodyWaterMass",
        value: round(bodyWaterMass),
        unit: "kg",
      },
      {
        type: "bodyWaterPercentage",
        value: round(bodyWaterPercentage),
        unit: "%",
      },
      { type: "boneMass", value: round(boneMass), unit: "kg" },
      { type: "proteinMass", value: round(proteinMass), unit: "kg" },
      {
        type: "proteinPercentage",
        value: round(proteinPercentage),
        unit: "%",
      },
      {
        type: "basalMetabolism",
        value: round(basalMetabolism, 0),
        unit: "kcal/day",
      },
      { type: "idealWeight", value: round(idealWeight), unit: "kg" },
    ],
  };
}
