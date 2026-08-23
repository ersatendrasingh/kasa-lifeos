import type { HealthEntryType } from "@/lib/health";
import type { ProfileDetails } from "@/lib/profile-details";

export type HealthInsightStatus =
  "on-track" | "below" | "above" | "attention" | "trend";

export type HealthInsight = {
  status: HealthInsightStatus;
  label: string;
  range: string;
  message: string;
  min?: number;
  max?: number;
};

function between(
  value: number,
  min: number,
  max: number,
  label: string,
  range: string,
  below: string,
  above: string,
): HealthInsight {
  if (value < min)
    return {
      status: "below",
      label: "BUILD UP",
      range,
      message: below,
      min,
      max,
    };
  if (value > max)
    return {
      status: "above",
      label: "BRING DOWN",
      range,
      message: above,
      min,
      max,
    };
  return {
    status: "on-track",
    label: "ON TRACK",
    range,
    message: "This is within the typical range.",
    min,
    max,
  };
}

function trend(
  message = "Use this to follow your personal trend over time.",
): HealthInsight {
  return {
    status: "trend",
    label: "TRACK THE TREND",
    range: "No universal healthy range",
    message,
  };
}

function ageFromBirthday(birthday: string) {
  if (!birthday) return null;
  const date = new Date(birthday);
  if (Number.isNaN(+date)) return null;
  const now = new Date();
  return (
    now.getFullYear() -
    date.getFullYear() -
    Number(now < new Date(now.getFullYear(), date.getMonth(), date.getDate()))
  );
}

export function healthInsight(
  type: HealthEntryType,
  value: number,
  profile: Pick<ProfileDetails, "biologicalSex" | "heightCm" | "birthday">,
): HealthInsight {
  const sex = profile.biologicalSex;
  const heightM = profile.heightCm ? profile.heightCm / 100 : null;

  switch (type) {
    case "weight":
      if (heightM) {
        const low = 18.5 * heightM * heightM;
        const high = 24.9 * heightM * heightM;
        return between(
          value,
          low,
          high,
          "BMI-BASED RANGE",
          `${low.toFixed(1)}–${high.toFixed(1)} kg for your height`,
          "Below the BMI-based range. Consider discussing unintentional weight change with a clinician.",
          "Above the BMI-based range. Focus on sustainable habits, not rapid change.",
        );
      }
      return trend("Add height in Profile to see a BMI-based weight range.");
    case "bmi":
      return between(
        value,
        18.5,
        24.9,
        "HEALTHY BMI",
        "18.5–24.9",
        "Below the adult BMI screening range.",
        "Above the adult BMI screening range.",
      );
    case "bloodPressureSystolic":
      return between(
        value,
        90,
        119,
        "NORMAL AT REST",
        "below 120 mmHg",
        "Lower than the usual resting range; repeat when you feel well.",
        "Above normal at rest. Repeat correctly and discuss persistent readings with a clinician.",
      );
    case "bloodPressureDiastolic":
      return between(
        value,
        60,
        79,
        "NORMAL AT REST",
        "below 80 mmHg",
        "Lower than the usual resting range; repeat when you feel well.",
        "Above normal at rest. Repeat correctly and discuss persistent readings with a clinician.",
      );
    case "heartRate":
      return between(
        value,
        60,
        100,
        "RESTING RANGE",
        "60–100 bpm",
        "Below the usual adult resting range. Context such as fitness and symptoms matters.",
        "Above the usual adult resting range. Recheck after resting quietly.",
      );
    case "spo2":
      return between(
        value,
        95,
        100,
        "TYPICAL RANGE",
        "95–100%",
        "Lower than the typical range. Repeat with warm hands and seek advice if it persists or you feel unwell.",
        "Higher than the device's expected scale; recheck the reading.",
      );
    case "bloodSugar":
      return between(
        value,
        70,
        99,
        "FASTING RANGE",
        "70–99 mg/dL fasting",
        "Below the typical fasting range. Consider the timing, symptoms, and clinician guidance.",
        "Above the typical fasting range. This applies only to a fasting reading; timing matters.",
      );
    case "temperature":
      return between(
        value,
        36.1,
        37.2,
        "TYPICAL ORAL RANGE",
        "36.1–37.2 °C",
        "Below a typical oral temperature. Method and environment matter.",
        "Above a typical oral temperature. Recheck; seek care for persistent fever or symptoms.",
      );
    case "bodyFat": {
      if (sex === "male")
        return between(
          value,
          10,
          22,
          "TYPICAL ADULT RANGE",
          "10–22%",
          "Below the typical adult male range.",
          "Above the typical adult male range.",
        );
      if (sex === "female")
        return between(
          value,
          20,
          32,
          "TYPICAL ADULT RANGE",
          "20–32%",
          "Below the typical adult female range.",
          "Above the typical adult female range.",
        );
      return trend(
        "Add biological sex in Profile to personalise this typical body-fat range.",
      );
    }
    case "bodyWaterPercentage":
      if (sex === "male")
        return between(
          value,
          50,
          65,
          "TYPICAL SCALE RANGE",
          "50–65%",
          "Below the typical scale range. Hydration and measurement conditions affect this.",
          "Above the typical scale range. Hydration and measurement conditions affect this.",
        );
      if (sex === "female")
        return between(
          value,
          45,
          60,
          "TYPICAL SCALE RANGE",
          "45–60%",
          "Below the typical scale range. Hydration and measurement conditions affect this.",
          "Above the typical scale range. Hydration and measurement conditions affect this.",
        );
      return trend(
        "Add biological sex in Profile to personalise this scale estimate.",
      );
    case "sleep":
      return between(
        value,
        7,
        9,
        "ADULT GUIDANCE",
        "7–9 hours",
        "Below the usual adult sleep guidance. Aim for a consistent earlier wind-down.",
        "Above the usual adult sleep guidance. Quality and how you feel matter too.",
      );
    case "water":
      return trend(
        "Your daily water progress is compared with your personal 3 L goal.",
      );
    case "height":
      return trend(
        "Your height is a profile baseline used to personalise BMI and weight insights.",
      );
    case "idealWeight":
    case "bodyScore":
    case "bodyAge":
    case "basalMetabolism":
    case "impedance":
      return trend(
        "This is a scale estimate, best used to follow your own trend rather than as a diagnosis.",
      );
    case "fatMass":
    case "fatFreeMass":
    case "leanMass":
    case "muscleMass":
    case "skeletalMuscleMass":
    case "musclePercentage":
    case "bodyWaterMass":
    case "visceralFat":
    case "subcutaneousFat":
    case "boneMass":
    case "proteinMass":
    case "proteinPercentage":
      return trend(
        "Scale estimates can vary with hydration. Compare readings under similar conditions.",
      );
    default:
      return trend();
  }
}

export function profileAge(profile: Pick<ProfileDetails, "birthday">) {
  return ageFromBirthday(profile.birthday);
}
