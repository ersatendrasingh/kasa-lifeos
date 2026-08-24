import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { useCallback, useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import {
  createHealthEntry,
  listHealthEntries,
  type HealthEntry,
  type HealthEntryType,
} from "@/lib/health";
import { healthInsight } from "@/lib/health-insights";
import {
  createMedicinePlan,
  listMedicinePlans,
  type MedicinePlan,
} from "@/lib/medicine-plans";
import {
  getProfileDetails,
  saveProfileDetails,
  type ProfileDetails,
} from "@/lib/profile-details";

type Section = "today" | "measurements" | "activities" | "wellness";
type Theme = ReturnType<typeof useTheme>;
type SymbolName = ComponentProps<typeof SymbolView>["name"];
type EntryOption = {
  type: HealthEntryType;
  label: string;
  unit: string;
  placeholder: string;
  icon: SymbolName;
  section: Exclude<Section, "today">;
};

const DAY = 86_400_000;
const WATER_GOAL = 3_000;
const STEPS_GOAL = 8_000;
const SLEEP_GOAL = 8;

const options: EntryOption[] = [
  {
    type: "weight",
    label: "Weight",
    unit: "kg",
    placeholder: "74.2",
    icon: "scalemass.fill",
    section: "measurements",
  },
  {
    type: "height",
    label: "Height",
    unit: "cm",
    placeholder: "175",
    icon: "ruler.fill",
    section: "measurements",
  },
  {
    type: "bmi",
    label: "BMI",
    unit: "score",
    placeholder: "24.2",
    icon: "chart.bar.fill",
    section: "measurements",
  },
  {
    type: "bloodPressureSystolic",
    label: "BP systolic",
    unit: "mmHg",
    placeholder: "120",
    icon: "waveform.path.ecg",
    section: "measurements",
  },
  {
    type: "bloodPressureDiastolic",
    label: "BP diastolic",
    unit: "mmHg",
    placeholder: "80",
    icon: "waveform.path.ecg",
    section: "measurements",
  },
  {
    type: "heartRate",
    label: "Heart rate",
    unit: "bpm",
    placeholder: "72",
    icon: "heart.fill",
    section: "measurements",
  },
  {
    type: "spo2",
    label: "SpO₂",
    unit: "%",
    placeholder: "98",
    icon: "lungs.fill",
    section: "measurements",
  },
  {
    type: "bloodSugar",
    label: "Blood sugar",
    unit: "mg/dL",
    placeholder: "95",
    icon: "drop.fill",
    section: "measurements",
  },
  {
    type: "temperature",
    label: "Temperature",
    unit: "°C",
    placeholder: "36.8",
    icon: "thermometer.medium",
    section: "measurements",
  },
  {
    type: "bodyFat",
    label: "Body fat",
    unit: "%",
    placeholder: "18",
    icon: "figure.arms.open",
    section: "measurements",
  },
  {
    type: "fatMass",
    label: "Fat mass",
    unit: "kg",
    placeholder: "14.2",
    icon: "figure.arms.open",
    section: "measurements",
  },
  {
    type: "fatFreeMass",
    label: "Fat-free mass",
    unit: "kg",
    placeholder: "60",
    icon: "figure.strengthtraining.traditional",
    section: "measurements",
  },
  {
    type: "leanMass",
    label: "Lean mass",
    unit: "kg",
    placeholder: "58",
    icon: "figure.arms.open",
    section: "measurements",
  },
  {
    type: "visceralFat",
    label: "Visceral fat",
    unit: "score",
    placeholder: "8",
    icon: "circle.hexagongrid.fill",
    section: "measurements",
  },
  {
    type: "subcutaneousFat",
    label: "Subcutaneous fat",
    unit: "%",
    placeholder: "16",
    icon: "circle.dotted",
    section: "measurements",
  },
  {
    type: "muscleMass",
    label: "Muscle mass",
    unit: "kg",
    placeholder: "55",
    icon: "dumbbell.fill",
    section: "measurements",
  },
  {
    type: "skeletalMuscleMass",
    label: "Skeletal muscle",
    unit: "kg",
    placeholder: "28",
    icon: "figure.strengthtraining.traditional",
    section: "measurements",
  },
  {
    type: "musclePercentage",
    label: "Muscle rate",
    unit: "%",
    placeholder: "40",
    icon: "dumbbell.fill",
    section: "measurements",
  },
  {
    type: "bodyWaterMass",
    label: "Water weight",
    unit: "kg",
    placeholder: "42",
    icon: "drop.fill",
    section: "measurements",
  },
  {
    type: "bodyWaterPercentage",
    label: "Body water",
    unit: "%",
    placeholder: "58",
    icon: "drop.fill",
    section: "measurements",
  },
  {
    type: "boneMass",
    label: "Bone mass",
    unit: "kg",
    placeholder: "3.1",
    icon: "figure.stand",
    section: "measurements",
  },
  {
    type: "proteinMass",
    label: "Protein mass",
    unit: "kg",
    placeholder: "11",
    icon: "chart.bar.fill",
    section: "measurements",
  },
  {
    type: "proteinPercentage",
    label: "Protein",
    unit: "%",
    placeholder: "16",
    icon: "chart.bar.fill",
    section: "measurements",
  },
  {
    type: "basalMetabolism",
    label: "Basal metabolism",
    unit: "kcal/day",
    placeholder: "1550",
    icon: "flame.fill",
    section: "measurements",
  },
  {
    type: "idealWeight",
    label: "Ideal weight",
    unit: "kg",
    placeholder: "68",
    icon: "target",
    section: "measurements",
  },
  {
    type: "bodyAge",
    label: "Body age",
    unit: "years",
    placeholder: "30",
    icon: "calendar",
    section: "measurements",
  },
  {
    type: "bodyScore",
    label: "Body score",
    unit: "score",
    placeholder: "82",
    icon: "gauge.with.dots.needle.50percent",
    section: "measurements",
  },
  {
    type: "impedance",
    label: "Impedance",
    unit: "ohm",
    placeholder: "552",
    icon: "bolt.fill",
    section: "measurements",
  },
  {
    type: "steps",
    label: "Steps",
    unit: "count",
    placeholder: "6500",
    icon: "figure.walk",
    section: "activities",
  },
  {
    type: "walk",
    label: "Walk",
    unit: "km",
    placeholder: "3.5",
    icon: "figure.walk",
    section: "activities",
  },
  {
    type: "run",
    label: "Run",
    unit: "km",
    placeholder: "5",
    icon: "figure.run",
    section: "activities",
  },
  {
    type: "cycling",
    label: "Cycling",
    unit: "km",
    placeholder: "12",
    icon: "figure.outdoor.cycle",
    section: "activities",
  },
  {
    type: "gym",
    label: "Gym",
    unit: "min",
    placeholder: "45",
    icon: "dumbbell.fill",
    section: "activities",
  },
  {
    type: "yoga",
    label: "Yoga",
    unit: "min",
    placeholder: "30",
    icon: "figure.yoga",
    section: "activities",
  },
  {
    type: "swimming",
    label: "Swimming",
    unit: "min",
    placeholder: "30",
    icon: "figure.pool.swim",
    section: "activities",
  },
  {
    type: "water",
    label: "Water",
    unit: "ml",
    placeholder: "250",
    icon: "drop.fill",
    section: "wellness",
  },
  {
    type: "sleep",
    label: "Sleep",
    unit: "hours",
    placeholder: "7.5",
    icon: "moon.stars.fill",
    section: "wellness",
  },
  {
    type: "medicine",
    label: "Medicine",
    unit: "dose",
    placeholder: "1",
    icon: "pills.fill",
    section: "wellness",
  },
  {
    type: "meditation",
    label: "Meditation",
    unit: "min",
    placeholder: "10",
    icon: "brain.head.profile.fill",
    section: "activities",
  },
  {
    type: "stretching",
    label: "Stretching",
    unit: "min",
    placeholder: "10",
    icon: "figure.flexibility",
    section: "activities",
  },
  {
    type: "standUp",
    label: "Stand up",
    unit: "count",
    placeholder: "1",
    icon: "figure.stand",
    section: "wellness",
  },
  {
    type: "eyeRest",
    label: "Eye rest",
    unit: "min",
    placeholder: "2",
    icon: "eye.fill",
    section: "wellness",
  },
  {
    type: "breathing",
    label: "Breathing",
    unit: "min",
    placeholder: "5",
    icon: "wind",
    section: "wellness",
  },
  {
    type: "sunlight",
    label: "Sunlight",
    unit: "min",
    placeholder: "15",
    icon: "sun.max.fill",
    section: "wellness",
  },
  {
    type: "healthyMeal",
    label: "Healthy meal",
    unit: "count",
    placeholder: "1",
    icon: "leaf.fill",
    section: "wellness",
  },
];

const catalogue = {
  measurements: [
    "Weight",
    "Height",
    "BMI",
    "BP systolic",
    "BP diastolic",
    "Blood sugar",
    "Heart rate",
    "SpO₂",
    "Body fat",
    "Temperature",
  ],
  activities: [
    "Steps",
    "Walk",
    "Run",
    "Cycling",
    "Gym",
    "Yoga",
    "Swimming",
    "Meditation",
    "Stretching",
  ],
  wellness: [
    "Water",
    "Medicine",
    "Sleep",
    "Stand up",
    "Eye rest",
    "Breathing",
    "Sunlight",
    "Healthy meal",
  ],
};

const format = (value: number, digits = 1) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(
    value,
  );

function isToday(value: string, reference: number) {
  return new Date(value).toDateString() === new Date(reference).toDateString();
}

const emptyProfile: ProfileDetails = {
  birthday: "",
  phone: "",
  preferredName: "",
  biologicalSex: "",
  heightCm: null,
  panNumber: "",
  aadhaarNumber: "",
  bloodGroup: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  avatarUrl: "",
};

function sourceLabel(source: string) {
  return source === "smart-scale" ? "Smart Scale" : "Manual entry";
}

function dedupeHealthEntries(entries: HealthEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const sessionId = entry.metadata?.measurementSessionId;
    const key =
      entry.source === "smart-scale" && typeof sessionId === "string"
        ? `${sessionId}:${entry.type}`
        : entry.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function HealthScreen() {
  const c = useTheme();
  const { measure } = useLocalSearchParams<{ measure?: string }>();
  const requestedMeasure =
    typeof measure === "string" &&
    options.some((option) => option.type === measure)
      ? (measure as HealthEntryType)
      : null;
  const insets = useSafeAreaInsets();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [medicinePlans, setMedicinePlans] = useState<MedicinePlan[]>([]);
  const [profile, setProfile] = useState<ProfileDetails>(emptyProfile);
  const [section, setSection] = useState<Section>(() =>
    requestedMeasure ? "measurements" : "today",
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [medicinePlanOpen, setMedicinePlanOpen] = useState(false);
  const [weightAnalyticsOpen, setWeightAnalyticsOpen] = useState(false);
  const [rangeInsightType, setRangeInsightType] =
    useState<HealthEntryType | null>(requestedMeasure);
  const [selectedType, setSelectedType] = useState<HealthEntryType>("weight");
  const [value, setValue] = useState("");
  const [medicineName, setMedicineName] = useState("Vitamin D");
  const [error, setError] = useState<string | null>(null);
  const [referenceNow] = useState(() => Date.now());

  async function load(background = false) {
    if (background) setRefreshing(true);
    try {
      const [items, profileDetails, plans] = await Promise.all([
        listHealthEntries(),
        userId ? getProfileDetails(userId) : Promise.resolve(emptyProfile),
        // A medicine plan is optional. Its endpoint must never block the
        // rest of Health Hub if an older development API is still restarting.
        listMedicinePlans().catch(() => []),
      ]);
      setEntries(dedupeHealthEntries(items));
      setProfile(profileDetails);
      setMedicinePlans(plans);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load Health Hub.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([
        listHealthEntries(),
        userId ? getProfileDetails(userId) : Promise.resolve(emptyProfile),
        listMedicinePlans().catch(() => []),
      ])
        .then(([items, profileDetails, plans]) => {
          if (active) {
            setEntries(dedupeHealthEntries(items));
            setProfile(profileDetails);
            setMedicinePlans(plans);
            setError(null);
          }
        })
        .catch((cause: unknown) => {
          if (active) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not load Health Hub.",
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [userId]),
  );

  const summary = useMemo(() => {
    const today = entries.filter((entry) =>
      isToday(entry.recordedAt, referenceNow),
    );
    const total = (type: HealthEntryType) =>
      today
        .filter((entry) => entry.type === type)
        .reduce((sum, entry) => sum + entry.value, 0);
    const latest = (type: HealthEntryType) =>
      entries.find((entry) => entry.type === type);
    const water = total("water");
    const steps = total("steps");
    const sleep = latest("sleep")?.value ?? 0;
    const medicine = total("medicine") > 0;
    const weight = latest("weight");
    const previousWeight = entries.find(
      (entry) =>
        entry.type === "weight" &&
        weight &&
        entry.id !== weight.id &&
        +new Date(entry.recordedAt) <= +new Date(weight.recordedAt) - 5 * DAY,
    );
    const available = [
      water > 0,
      sleep > 0,
      steps > 0,
      entries.some((entry) => entry.type === "medicine"),
    ];
    const components = [
      Math.min(water / WATER_GOAL, 1),
      Math.min(sleep / SLEEP_GOAL, 1),
      Math.min(steps / STEPS_GOAL, 1),
      medicine ? 1 : 0,
    ];
    const score = available.some(Boolean)
      ? Math.round(
          (components.reduce(
            (sum, item, index) => sum + (available[index] ? item : 0),
            0,
          ) /
            available.filter(Boolean).length) *
            100,
        )
      : null;
    return {
      water,
      steps,
      sleep,
      medicine,
      weight,
      previousWeight,
      score,
    };
  }, [entries, referenceNow]);

  const selected =
    options.find((item) => item.type === selectedType) ?? options[0];
  function openEntry(type: HealthEntryType) {
    setSelectedType(type);
    setValue(type === "medicine" ? "1" : "");
    setError(null);
    setSheetOpen(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function saveEntry(quickValue?: number) {
    const amount = quickValue ?? Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a value greater than zero.");
      return;
    }
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      const entry = await createHealthEntry({
        type: selected.type,
        value: amount,
        unit: selected.unit,
        recordedAt: new Date().toISOString(),
        metadata:
          selected.type === "medicine"
            ? { name: medicineName.trim() || "Medicine", completed: true }
            : undefined,
      });
      if (selected.type === "height" && userId) {
        const nextProfile = { ...profile, heightCm: amount };
        await saveProfileDetails(userId, nextProfile);
        setProfile(nextProfile);
      }
      setEntries((current) => [entry, ...current]);
      setSheetOpen(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save this entry.",
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }

  async function quickWater(amount: number) {
    setSelectedType("water");
    setSaving(true);
    setError(null);
    try {
      const entry = await createHealthEntry({
        type: "water",
        value: amount,
        unit: "ml",
        recordedAt: new Date().toISOString(),
      });
      setEntries((current) => [entry, ...current]);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not log water.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top"]} style={s.safe}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={c.brand}
              onRefresh={() => void load(true)}
            />
          }
        >
          <AppHeader label="Health Hub" />
          <View style={s.headingRow}>
            <View style={s.headingCopy}>
              <Text style={[s.eyebrow, { color: c.brand }]}>
                PERSONAL WELLBEING
              </Text>
              <Text style={[s.title, { color: c.text }]}>
                Health, kept simple.
              </Text>
              <Text style={[s.subtitle, { color: c.textSecondary }]}>
                Small daily signals. Clearer patterns over time.
              </Text>
            </View>
            <View style={s.headingActions}>
              <Pressable
                accessibilityLabel="Connect a health source"
                onPress={() => router.push("/health-devices")}
                style={({ pressed }) => [
                  s.sourceButton,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <SymbolView
                  name="antenna.radiowaves.left.and.right"
                  size={16}
                  tintColor={c.brand}
                />
              </Pressable>
              <Pressable
                accessibilityLabel="Log health"
                onPress={() => openEntry("weight")}
                style={({ pressed }) => [
                  s.addButton,
                  { backgroundColor: c.brand, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <SymbolView name="plus" size={19} tintColor="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <View
            style={[
              s.tabs,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {(["today", "measurements", "activities", "wellness"] as const).map(
              (item) => (
                <Pressable
                  key={item}
                  onPress={() => setSection(item)}
                  style={[
                    s.tab,
                    section === item && { backgroundColor: c.text },
                  ]}
                >
                  <Text
                    style={[
                      s.tabText,
                      {
                        color:
                          section === item ? c.background : c.textSecondary,
                      },
                    ]}
                  >
                    {item === "today"
                      ? "Today"
                      : item === "measurements"
                        ? "Measure"
                        : item === "activities"
                          ? "Move"
                          : "Wellness"}
                  </Text>
                </Pressable>
              ),
            )}
          </View>

          {error && !sheetOpen && (
            <Text style={[s.pageError, { color: c.brand }]}>{error}</Text>
          )}
          {loading ? (
            <View style={s.loading}>
              <KasaSpinner size={28} />
            </View>
          ) : section === "today" ? (
            <TodayContent
              summary={summary}
              entries={entries}
              openEntry={openEntry}
              quickWater={quickWater}
              saving={saving}
              colors={c}
              referenceNow={referenceNow}
              openWeightAnalytics={() => setWeightAnalyticsOpen(true)}
              openRangeInsight={setRangeInsightType}
              profile={profile}
            />
          ) : section === "measurements" ? (
            <MeasurementsContent
              entries={entries}
              profile={profile}
              openEntry={openEntry}
              openRangeInsight={setRangeInsightType}
              colors={c}
            />
          ) : (
            <CategoryContent
              section={section}
              entries={entries}
              openEntry={openEntry}
              medicinePlans={medicinePlans}
              openMedicinePlan={() => setMedicinePlanOpen(true)}
              colors={c}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.modalRoot}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSheetOpen(false)}
          />
          <View
            style={[
              s.sheet,
              {
                backgroundColor: c.background,
                paddingBottom: Math.max(insets.bottom, 18) + 8,
              },
            ]}
          >
            <View style={[s.handle, { backgroundColor: c.border }]} />
            <View style={s.sheetHead}>
              <View style={s.sheetTitleRow}>
                <View
                  style={[s.sheetEntryIcon, { backgroundColor: c.brandSoft }]}
                >
                  <SymbolView
                    name={selected.icon}
                    size={18}
                    tintColor={c.brand}
                  />
                </View>
                <View>
                  <Text style={[s.sheetEyebrow, { color: c.brand }]}>
                    MANUAL ENTRY
                  </Text>
                  <Text style={[s.sheetTitle, { color: c.text }]}>
                    Log {selected.label.toLowerCase()}
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityLabel="Close"
                onPress={() => setSheetOpen(false)}
                style={[s.close, { backgroundColor: c.backgroundElement }]}
              >
                <SymbolView name="xmark" size={14} tintColor={c.text} />
              </Pressable>
            </View>
            {selected.type === "medicine" && (
              <View
                style={[
                  s.inputWrap,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <Text style={[s.inputLabel, { color: c.textSecondary }]}>
                  MEDICINE
                </Text>
                <TextInput
                  value={medicineName}
                  onChangeText={setMedicineName}
                  style={[s.input, { color: c.text }]}
                  placeholder="Vitamin D"
                  placeholderTextColor={c.textSecondary}
                />
              </View>
            )}
            <View
              style={[
                s.inputWrap,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text style={[s.inputLabel, { color: c.textSecondary }]}>
                {selected.type === "medicine"
                  ? "DOSES COMPLETED"
                  : selected.label.toUpperCase()}
              </Text>
              <View style={s.valueRow}>
                <TextInput
                  autoFocus
                  keyboardType="decimal-pad"
                  value={value}
                  onChangeText={setValue}
                  placeholder={selected.placeholder}
                  placeholderTextColor={c.textSecondary}
                  style={[s.valueInput, { color: c.text }]}
                />
                <Text style={[s.unit, { color: c.textSecondary }]}>
                  {selected.unit}
                </Text>
              </View>
            </View>
            {selected.type !== "medicine" ? (
              <View style={s.quickValueRow}>
                {(selected.section === "activities"
                  ? ["10", "20", "30", "45", "60"]
                  : selected.type === "water"
                    ? ["250", "500", "750", "1000"]
                    : selected.type === "sleep"
                      ? ["6", "7", "8", "9"]
                      : [selected.placeholder]
                ).map((preset) => (
                  <Pressable
                    key={preset}
                    onPress={() => setValue(preset)}
                    style={[
                      s.quickValue,
                      {
                        backgroundColor:
                          value === preset ? c.brandSoft : c.backgroundElement,
                        borderColor: value === preset ? c.brand : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.quickValueText,
                        { color: value === preset ? c.brand : c.textSecondary },
                      ]}
                    >
                      {preset} {selected.unit}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {error && (
              <Text style={[s.sheetError, { color: c.brand }]}>{error}</Text>
            )}
            <Pressable
              disabled={saving}
              onPress={() => void saveEntry()}
              style={({ pressed }) => [
                s.saveButton,
                {
                  backgroundColor: c.brand,
                  opacity: saving || pressed ? 0.68 : 1,
                },
              ]}
            >
              {saving ? (
                <KasaSpinner size={19} color="#FFFFFF" />
              ) : (
                <>
                  <SymbolView name="checkmark" size={15} tintColor="#FFFFFF" />
                  <Text style={s.saveText}>Save entry</Text>
                </>
              )}
            </Pressable>
            <Text style={[s.sourceNote, { color: c.textSecondary }]}>
              Saved as Manual Entry · connected readings keep their own source
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <WeightAnalyticsSheet
        visible={weightAnalyticsOpen}
        entries={entries}
        colors={c}
        bottomInset={insets.bottom}
        onClose={() => setWeightAnalyticsOpen(false)}
        onManual={() => {
          setWeightAnalyticsOpen(false);
          openEntry("weight");
        }}
      />
      <MeasurementRangeSheet
        type={rangeInsightType}
        entries={entries}
        profile={profile}
        colors={c}
        bottomInset={insets.bottom}
        onClose={() => setRangeInsightType(null)}
        onManual={openEntry}
      />
      <MedicinePlanSheet
        visible={medicinePlanOpen}
        colors={c}
        bottomInset={insets.bottom}
        onClose={() => setMedicinePlanOpen(false)}
        onSaved={(plan) => {
          setMedicinePlans((current) => [plan, ...current]);
          setMedicinePlanOpen(false);
        }}
      />
    </View>
  );
}

type Summary = {
  water: number;
  steps: number;
  sleep: number;
  medicine: boolean;
  weight?: HealthEntry;
  previousWeight?: HealthEntry;
  score: number | null;
};

function TodayContent({
  summary,
  entries,
  openEntry,
  quickWater,
  saving,
  colors: c,
  referenceNow,
  openWeightAnalytics,
  openRangeInsight,
  profile,
}: {
  summary: Summary;
  entries: HealthEntry[];
  openEntry: (type: HealthEntryType) => void;
  quickWater: (amount: number) => Promise<void>;
  saving: boolean;
  colors: Theme;
  referenceNow: number;
  openWeightAnalytics: () => void;
  openRangeInsight: (type: HealthEntryType) => void;
  profile: ProfileDetails;
}) {
  const delta =
    summary.weight && summary.previousWeight
      ? summary.weight.value - summary.previousWeight.value
      : null;
  const weekly = entries.filter(
    (entry) => +new Date(entry.recordedAt) > referenceNow - 7 * DAY,
  );
  const dailyAverage = (type: HealthEntryType) => {
    const items = weekly.filter((entry) => entry.type === type);
    const days = new Set(
      items.map((entry) => new Date(entry.recordedAt).toDateString()),
    ).size;
    return items.length
      ? items.reduce((sum, entry) => sum + entry.value, 0) / Math.max(days, 1)
      : 0;
  };
  const latest = (type: HealthEntryType) =>
    entries.find((entry) => entry.type === type);
  const bodySnapshot = [
    {
      type: "bmi" as const,
      label: "BMI",
      icon: "chart.line.uptrend.xyaxis" as SymbolName,
    },
    {
      type: "bodyFat" as const,
      label: "Body fat",
      icon: "drop.fill" as SymbolName,
    },
    {
      type: "musclePercentage" as const,
      label: "Muscle",
      icon: "dumbbell.fill" as SymbolName,
    },
    {
      type: "bodyWaterPercentage" as const,
      label: "Body water",
      icon: "waterbottle.fill" as SymbolName,
    },
  ];
  return (
    <>
      <Pressable
        onPress={openWeightAnalytics}
        style={({ pressed }) => [
          s.todayBodyShadow,
          { opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <View style={s.todayBodyClip}>
          <LinearGradient
            colors={[c.brand, c.brandStrong]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.todayBodyHero}
          >
            <View style={s.todayBodyOrb} />
            <View style={s.todayHeroTop}>
              <View>
                <Text style={s.todayHeroEyebrow}>TODAY&apos;S BODY</Text>
                <Text style={s.todayHeroValue}>
                  {summary.weight ? format(summary.weight.value) : "—"}
                  <Text style={s.todayHeroUnit}> kg</Text>
                </Text>
                <Text style={s.todayHeroSource}>
                  {summary.weight
                    ? `${sourceLabel(summary.weight.source)} · ${new Date(summary.weight.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : "Add weight manually or connect a scale"}
                </Text>
              </View>
              <View style={s.todayTrendPill}>
                <Text style={s.todayTrendValue}>
                  {delta === null
                    ? "FIRST"
                    : `${delta <= 0 ? "↓" : "↑"} ${format(Math.abs(delta))} kg`}
                </Text>
                <Text style={s.todayTrendLabel}>VIEW TREND</Text>
              </View>
            </View>
            <View style={s.todayHeroFooter}>
              <SymbolView
                name="chart.xyaxis.line"
                size={15}
                tintColor="#FFFFFF"
              />
              <Text style={s.todayHeroFooterText}>
                Open weight analytics and measurement history
              </Text>
              <SymbolView name="chevron.right" size={10} tintColor="#FFFFFF" />
            </View>
          </LinearGradient>
        </View>
      </Pressable>

      <View style={s.sectionHead}>
        <View>
          <Text style={[s.sectionTitle, { color: c.text }]}>Body snapshot</Text>
          <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
            Latest connected and manual measurements
          </Text>
        </View>
        <Pressable onPress={() => openEntry("weight")}>
          <Text style={[s.textLink, { color: c.brand }]}>+ MANUAL</Text>
        </Pressable>
      </View>
      <View style={s.bodySnapshotGrid}>
        {bodySnapshot.map((item) => {
          const entry = latest(item.type);
          const insight = entry
            ? healthInsight(item.type, entry.value, profile)
            : null;
          return (
            <Pressable
              key={item.type}
              onPress={() => openRangeInsight(item.type)}
              style={[
                s.bodySnapshotCard,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <View
                style={[s.bodySnapshotIcon, { backgroundColor: c.brandSoft }]}
              >
                <SymbolView name={item.icon} size={14} tintColor={c.brand} />
              </View>
              <Text style={[s.bodySnapshotLabel, { color: c.textSecondary }]}>
                {item.label}
              </Text>
              <Text style={[s.bodySnapshotValue, { color: c.text }]}>
                {entry ? format(entry.value) : "—"}
                {entry ? (
                  <Text style={s.bodySnapshotUnit}>
                    {" "}
                    {entry.unit === "score" ? "" : entry.unit}
                  </Text>
                ) : null}
              </Text>
              <Text
                style={[
                  s.bodySnapshotSource,
                  {
                    color:
                      entry?.source === "smart-scale"
                        ? c.brand
                        : c.textSecondary,
                  },
                ]}
              >
                {entry ? sourceLabel(entry.source) : "No data yet"}
              </Text>
              {insight ? (
                <Text
                  numberOfLines={1}
                  style={[
                    s.bodySnapshotInsight,
                    {
                      color:
                        insight.status === "on-track"
                          ? c.brand
                          : c.textSecondary,
                    },
                  ]}
                >
                  {insight.label} · {insight.range}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={s.sectionHead}>
        <View>
          <Text style={[s.sectionTitle, { color: c.text }]}>Daily rhythm</Text>
          <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
            Small actions that shape today
          </Text>
        </View>
      </View>
      <View
        style={[
          s.dailyRhythm,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <DailySignal
          colors={c}
          icon="drop.fill"
          label="Water"
          value={`${format(summary.water / 1000)} L`}
          progress={summary.water / WATER_GOAL}
          action="+250 ml"
          onPress={() => void quickWater(250)}
          disabled={saving}
        />
        <DailySignal
          colors={c}
          icon="figure.walk"
          label="Steps"
          value={summary.steps ? format(summary.steps, 0) : "—"}
          progress={summary.steps / STEPS_GOAL}
          action="LOG"
          onPress={() => openEntry("steps")}
        />
        <DailySignal
          colors={c}
          icon="moon.stars.fill"
          label="Sleep"
          value={summary.sleep ? `${format(summary.sleep)} h` : "—"}
          progress={summary.sleep / SLEEP_GOAL}
          action="LOG"
          onPress={() => openEntry("sleep")}
        />
      </View>

      <Pressable
        onPress={() => openEntry("medicine")}
        style={({ pressed }) => [
          s.medicineCard,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            opacity: pressed ? 0.74 : 1,
          },
        ]}
      >
        <View style={[s.medicineIcon, { backgroundColor: c.brandSoft }]}>
          <SymbolView name="pills.fill" size={19} tintColor={c.brand} />
        </View>
        <View style={s.medicineCopy}>
          <Text style={[s.medicineTitle, { color: c.text }]}>Medicine</Text>
          <Text style={[s.medicineDetail, { color: c.textSecondary }]}>
            {summary.medicine
              ? "Today’s dose completed"
              : "Log when you take today’s dose"}
          </Text>
        </View>
        <View
          style={[
            s.medicineStatus,
            {
              backgroundColor: summary.medicine
                ? c.brandSoft
                : c.backgroundElement,
            },
          ]}
        >
          <SymbolView
            name={summary.medicine ? "checkmark" : "plus"}
            size={12}
            tintColor={c.brand}
          />
        </View>
      </Pressable>

      <View
        style={[
          s.coachCard,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <View style={s.coachTop}>
          <View style={[s.coachIcon, { backgroundColor: c.brandSoft }]}>
            <SymbolView name="sparkles" size={17} tintColor={c.brand} />
          </View>
          <View style={s.coachCopy}>
            <Text style={[s.coachLabel, { color: c.brand }]}>
              WELLNESS COACH
            </Text>
            <Text style={[s.coachTitle, { color: c.text }]}>
              One useful nudge
            </Text>
          </View>
        </View>
        <View style={[s.nudge, { backgroundColor: c.backgroundElement }]}>
          <Text style={s.nudgeEmoji}>💧</Text>
          <Text style={[s.nudgeText, { color: c.text }]}>
            {summary.water
              ? `You’ve logged ${format(summary.water / 1000)} L today. Another small glass would fit well now.`
              : "No water logged yet. Start with one glass—no pressure."}
          </Text>
        </View>
        <Text style={[s.coachNote, { color: c.textSecondary }]}>
          Learns your rhythm before suggesting a time.
        </Text>
      </View>

      <View
        style={[
          s.reviewCard,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <View style={s.reviewHead}>
          <View>
            <Text style={[s.reviewLabel, { color: c.textSecondary }]}>
              SUNDAY REVIEW
            </Text>
            <Text style={[s.reviewTitle, { color: c.text }]}>This week</Text>
          </View>
          <Text
            style={[
              s.reviewRange,
              { color: c.textSecondary, backgroundColor: c.backgroundElement },
            ]}
          >
            7 DAYS
          </Text>
        </View>
        <View style={s.reviewGrid}>
          <ReviewStat
            colors={c}
            label="Walk"
            value={
              weekly.some((entry) => entry.type === "walk")
                ? `${format(weekly.filter((entry) => entry.type === "walk").reduce((sum, entry) => sum + entry.value, 0))} km`
                : "—"
            }
          />
          <ReviewStat
            colors={c}
            label="Sleep avg"
            value={
              dailyAverage("sleep")
                ? `${format(dailyAverage("sleep"))} hrs`
                : "—"
            }
          />
          <ReviewStat
            colors={c}
            label="Water avg"
            value={
              dailyAverage("water")
                ? `${format(dailyAverage("water") / 1000)} L`
                : "—"
            }
          />
          <ReviewStat
            colors={c}
            label="Weight"
            value={
              delta === null
                ? "—"
                : `${delta > 0 ? "+" : ""}${format(delta)} kg`
            }
          />
        </View>
      </View>
    </>
  );
}

function DailySignal({
  colors: c,
  icon,
  label,
  value,
  progress,
  action,
  onPress,
  disabled,
}: {
  colors: Theme;
  icon: SymbolName;
  label: string;
  value: string;
  progress: number;
  action: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.dailySignal}>
      <View style={[s.dailySignalIcon, { backgroundColor: c.brandSoft }]}>
        <SymbolView name={icon} size={14} tintColor={c.brand} />
      </View>
      <View style={s.dailySignalCopy}>
        <View style={s.dailySignalTop}>
          <Text style={[s.dailySignalLabel, { color: c.textSecondary }]}>
            {label}
          </Text>
          <Text style={[s.dailySignalValue, { color: c.text }]}>{value}</Text>
        </View>
        <View
          style={[s.dailySignalTrack, { backgroundColor: c.backgroundElement }]}
        >
          <View
            style={[
              s.dailySignalFill,
              {
                backgroundColor: c.brand,
                width: `${Math.min(100, Math.max(3, progress * 100))}%`,
              },
            ]}
          />
        </View>
      </View>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={[s.dailySignalAction, { backgroundColor: c.backgroundElement }]}
      >
        <Text style={[s.dailySignalActionText, { color: c.brand }]}>
          {action}
        </Text>
      </Pressable>
    </View>
  );
}

function MeasurementsContent({
  entries,
  profile,
  openEntry,
  openRangeInsight,
  colors: c,
}: {
  entries: HealthEntry[];
  profile: ProfileDetails;
  openEntry: (type: HealthEntryType) => void;
  openRangeInsight: (type: HealthEntryType) => void;
  colors: Theme;
}) {
  const measurementOptions = options.filter(
    (item) => item.section === "measurements",
  );
  const latest = (type: HealthEntryType) =>
    entries.find((entry) => entry.type === type);
  const weight = latest("weight");
  const bmi = latest("bmi");
  const fat = latest("bodyFat");
  const measuredCount = measurementOptions.filter(
    (item) => latest(item.type) || (item.type === "height" && profile.heightCm),
  ).length;
  const focusItems = measurementOptions
    .flatMap((item) => {
      const entry = latest(item.type);
      if (!entry) return [];
      const insight = healthInsight(item.type, entry.value, profile);
      return insight.status === "on-track" || insight.status === "trend"
        ? []
        : [{ item, entry, insight }];
    })
    .slice(0, 3);
  const orderedOptions = [...measurementOptions].sort((first, second) => {
    const firstHasValue =
      Boolean(latest(first.type)) ||
      (first.type === "height" && profile.heightCm)
        ? 1
        : 0;
    const secondHasValue =
      Boolean(latest(second.type)) ||
      (second.type === "height" && profile.heightCm)
        ? 1
        : 0;
    return secondHasValue - firstHasValue;
  });

  return (
    <>
      <View style={s.measureOverviewShadow}>
        <LinearGradient
          colors={[c.brand, c.brandStrong]}
          style={s.measureOverview}
        >
          <View style={s.measureOverviewTop}>
            <View>
              <Text style={s.measureOverviewEyebrow}>BODY MEASUREMENTS</Text>
              <Text style={s.measureOverviewTitle}>
                {weight ? `${format(weight.value)} kg` : "Start your baseline"}
              </Text>
              <Text style={s.measureOverviewMeta}>
                {weight
                  ? `${sourceLabel(weight.source)} · ${new Date(weight.recordedAt).toLocaleDateString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`
                  : "Manual entry and connected scales stay together"}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/health-devices")}
              style={s.measureSourceButton}
            >
              <SymbolView
                name="antenna.radiowaves.left.and.right"
                size={16}
                tintColor="#FFFFFF"
              />
            </Pressable>
          </View>
          <View style={s.measureOverviewStats}>
            <MeasureHeroStat
              label="BMI"
              value={bmi ? format(bmi.value) : "—"}
            />
            <MeasureHeroStat
              label="BODY FAT"
              value={fat ? `${format(fat.value)}%` : "—"}
            />
            <MeasureHeroStat
              label="TRACKED"
              value={`${measuredCount}/${measurementOptions.length}`}
            />
          </View>
        </LinearGradient>
      </View>

      <View style={s.sectionHead}>
        <View>
          <Text style={[s.sectionTitle, { color: c.text }]}>
            All measurements
          </Text>
          <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
            Profile, manual and smart-scale values in one place
          </Text>
        </View>
      </View>
      {focusItems.length ? (
        <View style={[s.focusPanel, { backgroundColor: c.brandSoft }]}>
          <View style={s.focusPanelHead}>
            <SymbolView name="target" size={14} tintColor={c.brand} />
            <Text style={[s.focusPanelTitle, { color: c.text }]}>
              Focus on these
            </Text>
          </View>
          {focusItems.map(({ item, entry, insight }) => (
            <Pressable
              key={item.type}
              onPress={() => openRangeInsight(item.type)}
              style={s.focusRow}
            >
              <View style={s.focusCopy}>
                <Text style={[s.focusName, { color: c.text }]}>
                  {item.label} · {format(entry.value)}{" "}
                  {item.unit === "score" ? "" : item.unit}
                </Text>
                <Text style={[s.focusMessage, { color: c.textSecondary }]}>
                  {insight.message}
                </Text>
              </View>
              <SymbolView name="chevron.right" size={10} tintColor={c.brand} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={s.measurementGrid}>
        {orderedOptions.map((item) => {
          const entry = latest(item.type);
          const profileHeight =
            item.type === "height" ? profile.heightCm : null;
          const value = profileHeight ?? entry?.value ?? null;
          const source = profileHeight
            ? "Profile"
            : entry
              ? `${sourceLabel(entry.source)}${entry.metadata?.derived === true ? " · estimated" : ""}`
              : "No data";
          const fromScale = entry?.source === "smart-scale" && !profileHeight;
          const insight =
            value === null ? null : healthInsight(item.type, value, profile);
          return (
            <Pressable
              key={item.type}
              onPress={() => openRangeInsight(item.type)}
              style={({ pressed }) => [
                s.measurementTile,
                {
                  backgroundColor: c.surface,
                  borderColor: c.border,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <View style={s.measurementTileTop}>
                <View
                  style={[
                    s.measurementTileIcon,
                    { backgroundColor: c.brandSoft },
                  ]}
                >
                  <SymbolView name={item.icon} size={15} tintColor={c.brand} />
                </View>
                <Pressable
                  onPress={() => openEntry(item.type)}
                  hitSlop={8}
                  style={[
                    s.measurementAdd,
                    { backgroundColor: c.backgroundElement },
                  ]}
                >
                  <SymbolView name="plus" size={9} tintColor={c.brand} />
                </Pressable>
              </View>
              <Text
                numberOfLines={1}
                style={[s.measurementTileLabel, { color: c.textSecondary }]}
              >
                {item.label}
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[s.measurementTileValue, { color: c.text }]}
              >
                {value === null ? "—" : format(value)}
                {value !== null ? (
                  <Text style={s.measurementTileUnit}>
                    {" "}
                    {item.unit === "score" ? "" : item.unit}
                  </Text>
                ) : null}
              </Text>
              <View style={s.measurementSourceRow}>
                <View
                  style={[
                    s.measurementSourceDot,
                    { backgroundColor: fromScale ? c.brand : c.textSecondary },
                  ]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    s.measurementSource,
                    { color: fromScale ? c.brand : c.textSecondary },
                  ]}
                >
                  {source}
                </Text>
              </View>
              {insight ? (
                <View style={s.rangeBlock}>
                  <View style={s.rangeCompactRow}>
                    <View
                      style={[
                        s.rangeCompactDot,
                        { backgroundColor: rangeTone(insight, value).color },
                      ]}
                    />
                    <Text
                      style={[
                        s.rangeStatus,
                        { color: rangeTone(insight, value).color },
                      ]}
                    >
                      {insight.label}
                    </Text>
                    <Text style={[s.rangeTap, { color: c.textSecondary }]}>
                      VIEW
                    </Text>
                  </View>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <MeasurementTimeline entries={entries} colors={c} />
    </>
  );
}

function MeasureHeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.measureHeroStat}>
      <Text style={s.measureHeroStatLabel}>{label}</Text>
      <Text style={s.measureHeroStatValue}>{value}</Text>
    </View>
  );
}

function rangeTone(
  insight: ReturnType<typeof healthInsight>,
  value: number | null,
) {
  if (insight.status === "on-track")
    return { color: "#22A06B", label: "Perfect range" };
  if (insight.status === "trend")
    return { color: "#8C7A72", label: "Personal trend" };
  const range = Math.max((insight.max ?? 1) - (insight.min ?? 0), 1);
  const distance =
    value === null || insight.min === undefined || insight.max === undefined
      ? 0
      : value < insight.min
        ? (insight.min - value) / range
        : value > insight.max
          ? (value - insight.max) / range
          : 0;
  return {
    color: distance > 0.3 ? "#E4574F" : "#E8AE32",
    label: "Needs attention",
  };
}

function measurementDescription(type: HealthEntryType) {
  const descriptions: Partial<Record<HealthEntryType, string>> = {
    weight:
      "Your body weight is most useful as a consistent trend, measured under similar conditions.",
    bmi: "BMI compares weight with height. It is a screening measure, not a diagnosis.",
    bodyFat:
      "Body-fat percentage is a scale estimate of how much of your body weight is fat mass.",
    bloodPressureSystolic:
      "Systolic pressure is the top blood-pressure number, measured when your heart contracts.",
    bloodPressureDiastolic:
      "Diastolic pressure is the bottom blood-pressure number, measured while your heart rests.",
    heartRate:
      "Resting heart rate is most meaningful after sitting quietly for a few minutes.",
    spo2: "Blood oxygen readings can be affected by cold hands, movement, nail products and device accuracy.",
    bloodSugar:
      "Blood-glucose meaning depends on timing. This reference is for fasting readings only.",
    temperature:
      "Temperature changes with measurement method, time of day and activity.",
    bodyWaterPercentage:
      "Body-water percentage is a smart-scale estimate and changes with hydration.",
    sleep:
      "Sleep duration is one signal; consistency, quality and how you feel also matter.",
  };
  return (
    descriptions[type] ??
    "This measurement is most useful when you compare readings taken under similar conditions over time."
  );
}

function MeasurementRangeSheet({
  type,
  entries,
  profile,
  colors: c,
  bottomInset,
  onClose,
  onManual,
}: {
  type: HealthEntryType | null;
  entries: HealthEntry[];
  profile: ProfileDetails;
  colors: Theme;
  bottomInset: number;
  onClose: () => void;
  onManual: (type: HealthEntryType) => void;
}) {
  const option = options.find((item) => item.type === type);
  const entry = type ? entries.find((item) => item.type === type) : undefined;
  const value = type === "height" ? profile.heightCm : entry?.value;
  const insight =
    type && value !== null && value !== undefined
      ? healthInsight(type, value, profile)
      : null;
  const range =
    insight?.max !== undefined && insight.min !== undefined
      ? Math.max(insight.max - insight.min, 1)
      : null;
  const marker =
    range !== null &&
    value !== null &&
    value !== undefined &&
    insight?.min !== undefined
      ? Math.max(4, Math.min(96, 25 + ((value - insight.min) / range) * 50))
      : null;
  const deviation =
    range !== null &&
    value !== null &&
    value !== undefined &&
    insight?.min !== undefined &&
    insight?.max !== undefined
      ? value < insight.min
        ? (insight.min - value) / range
        : value > insight.max
          ? (value - insight.max) / range
          : 0
      : 0;
  const tone = insight
    ? insight.status === "on-track"
      ? { color: "#22A06B", label: "PERFECT RANGE" }
      : insight.status === "trend"
        ? { color: c.textSecondary, label: "PERSONAL TREND" }
        : deviation > 0.3
          ? { color: "#E4574F", label: "NEEDS ATTENTION" }
          : { color: "#E8AE32", label: "WATCH THIS" }
    : { color: c.textSecondary, label: "NO READING" };

  return (
    <Modal
      visible={type !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            s.insightSheet,
            {
              backgroundColor: c.background,
              paddingBottom: Math.max(18, bottomInset),
            },
          ]}
        >
          <View style={[s.handle, { backgroundColor: c.border }]} />
          <View style={s.insightHead}>
            <View style={[s.insightIcon, { backgroundColor: c.brandSoft }]}>
              <SymbolView
                name={option?.icon ?? "waveform.path.ecg"}
                size={19}
                tintColor={c.brand}
              />
            </View>
            <View style={s.insightTitleCopy}>
              <Text style={[s.analyticsEyebrow, { color: c.brand }]}>
                MEASUREMENT GUIDE
              </Text>
              <Text style={[s.insightTitle, { color: c.text }]}>
                {option?.label ?? "Measurement"}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[s.close, { backgroundColor: c.backgroundElement }]}
            >
              <SymbolView name="xmark" size={13} tintColor={c.text} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {value !== null && value !== undefined && option ? (
              <>
                <View
                  style={[
                    s.insightValueCard,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <Text
                    style={[s.insightYourValue, { color: c.textSecondary }]}
                  >
                    YOUR VALUE
                  </Text>
                  <Text style={[s.insightNumber, { color: c.text }]}>
                    {format(value)}{" "}
                    <Text style={s.insightUnit}>
                      {option.unit === "score" ? "" : option.unit}
                    </Text>
                  </Text>
                  <View
                    style={[
                      s.insightStatePill,
                      { backgroundColor: `${tone.color}20` },
                    ]}
                  >
                    <View
                      style={[
                        s.insightStateDot,
                        { backgroundColor: tone.color },
                      ]}
                    />
                    <Text style={[s.insightStateText, { color: tone.color }]}>
                      {tone.label}
                    </Text>
                  </View>
                </View>
                {marker !== null && insight ? (
                  <View
                    style={[
                      s.spectrumCard,
                      { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                  >
                    <Text style={[s.spectrumLabel, { color: c.textSecondary }]}>
                      TYPICAL RANGE · {insight.range}
                    </Text>
                    <View style={s.spectrumTrack}>
                      <View
                        style={[
                          s.spectrumSegment,
                          { flex: 1, backgroundColor: "#E4574F" },
                        ]}
                      />
                      <View
                        style={[
                          s.spectrumSegment,
                          { flex: 1, backgroundColor: "#E8AE32" },
                        ]}
                      />
                      <View
                        style={[
                          s.spectrumSegment,
                          { flex: 2, backgroundColor: "#22A06B" },
                        ]}
                      />
                      <View
                        style={[
                          s.spectrumSegment,
                          { flex: 1, backgroundColor: "#E8AE32" },
                        ]}
                      />
                      <View
                        style={[
                          s.spectrumSegment,
                          { flex: 1, backgroundColor: "#E4574F" },
                        ]}
                      />
                      <View
                        style={[
                          s.spectrumPointer,
                          { left: `${marker}%`, borderColor: c.surface },
                        ]}
                      />
                    </View>
                    <View style={s.spectrumLegend}>
                      <Text
                        style={[
                          s.spectrumLegendText,
                          { color: c.textSecondary },
                        ]}
                      >
                        Build up
                      </Text>
                      <Text
                        style={[
                          s.spectrumLegendText,
                          { color: c.textSecondary },
                        ]}
                      >
                        Typical
                      </Text>
                      <Text
                        style={[
                          s.spectrumLegendText,
                          { color: c.textSecondary },
                        ]}
                      >
                        Bring down
                      </Text>
                    </View>
                  </View>
                ) : null}
                <View
                  style={[
                    s.insightDescription,
                    { backgroundColor: c.backgroundElement },
                  ]}
                >
                  <Text style={[s.insightDescriptionTitle, { color: c.text }]}>
                    What this means
                  </Text>
                  <Text
                    style={[
                      s.insightDescriptionText,
                      { color: c.textSecondary },
                    ]}
                  >
                    {measurementDescription(type!)}
                  </Text>
                  <Text style={[s.insightAction, { color: tone.color }]}>
                    {insight?.message}
                  </Text>
                </View>
                <Text style={[s.insightSource, { color: c.textSecondary }]}>
                  {entry
                    ? `${sourceLabel(entry.source)} · ${new Date(entry.recordedAt).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`
                    : "Profile baseline"}
                </Text>
              </>
            ) : (
              <View
                style={[
                  s.insightEmpty,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <Text style={[s.insightDescriptionTitle, { color: c.text }]}>
                  No reading yet
                </Text>
                <Text
                  style={[s.insightDescriptionText, { color: c.textSecondary }]}
                >
                  Add this measurement manually or let a connected health source
                  send it here.
                </Text>
              </View>
            )}
            {type ? (
              <Pressable
                onPress={() => {
                  onClose();
                  onManual(type);
                }}
                style={[s.insightManualButton, { backgroundColor: c.brand }]}
              >
                <SymbolView name="plus" size={14} tintColor="#FFFFFF" />
                <Text style={s.insightManualText}>Add manual reading</Text>
              </Pressable>
            ) : null}
            <Text style={[s.insightSafety, { color: c.textSecondary }]}>
              These are general wellness references, not a medical diagnosis. If
              you have symptoms or ongoing concerning readings, seek clinical
              advice.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MeasurementTimeline({
  entries,
  colors: c,
}: {
  entries: HealthEntry[];
  colors: Theme;
}) {
  const recent = entries
    .filter((entry) =>
      options.some(
        (item) => item.section === "measurements" && item.type === entry.type,
      ),
    )
    .slice(0, 12);
  return (
    <>
      <View style={s.sectionHead}>
        <View>
          <Text style={[s.sectionTitle, { color: c.text }]}>
            Recent readings
          </Text>
          <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
            Every reading keeps its original source and time
          </Text>
        </View>
      </View>
      <View
        style={[
          s.measureTimeline,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        {recent.map((entry, index) => {
          const item = options.find((option) => option.type === entry.type);
          return (
            <View
              key={entry.id}
              style={[
                s.measureTimelineRow,
                index > 0 && { borderTopWidth: 1, borderTopColor: c.border },
              ]}
            >
              <View
                style={[
                  s.measureTimelineIcon,
                  { backgroundColor: c.brandSoft },
                ]}
              >
                <SymbolView
                  name={item?.icon ?? "waveform.path.ecg"}
                  size={13}
                  tintColor={c.brand}
                />
              </View>
              <View style={s.measureTimelineCopy}>
                <Text style={[s.measureTimelineTitle, { color: c.text }]}>
                  {item?.label ?? entry.type}
                </Text>
                <Text
                  style={[s.measureTimelineMeta, { color: c.textSecondary }]}
                >
                  {sourceLabel(entry.source)}
                  {entry.metadata?.derived === true
                    ? " · estimated"
                    : ""} ·{" "}
                  {new Date(entry.recordedAt).toLocaleString([], {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <Text style={[s.measureTimelineValue, { color: c.text }]}>
                {format(entry.value)}{" "}
                <Text style={s.measureTimelineUnit}>
                  {entry.unit === "score" ? "" : entry.unit}
                </Text>
              </Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

function WeightAnalyticsSheet({
  visible,
  entries,
  colors: c,
  bottomInset,
  onClose,
  onManual,
}: {
  visible: boolean;
  entries: HealthEntry[];
  colors: Theme;
  bottomInset: number;
  onClose: () => void;
  onManual: () => void;
}) {
  const { width } = useWindowDimensions();
  const points = entries
    .filter((entry) => entry.type === "weight" && entry.value > 0)
    .sort((a, b) => +new Date(a.recordedAt) - +new Date(b.recordedAt))
    .slice(-16);
  const chartWidth = Math.max(260, width - 64);
  const chartHeight = 170;
  const values = points.map((point) => point.value);
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 0;
  const range = Math.max(high - low, 0.8);
  const coords = points.map((point, index) => ({
    point,
    x:
      points.length === 1
        ? chartWidth / 2
        : (index / (points.length - 1)) * chartWidth,
    y: 16 + ((high - point.value) / range) * (chartHeight - 34),
  }));
  const latest = points.at(-1);
  const change =
    latest && points.length > 1 ? latest.value - points[0].value : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            s.analyticsSheet,
            {
              backgroundColor: c.background,
              paddingBottom: Math.max(18, bottomInset),
            },
          ]}
        >
          <View style={[s.handle, { backgroundColor: c.border }]} />
          <View style={s.analyticsHeader}>
            <View>
              <Text style={[s.analyticsEyebrow, { color: c.brand }]}>
                WEIGHT ANALYTICS
              </Text>
              <Text style={[s.analyticsTitle, { color: c.text }]}>
                Your weight trend
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[s.close, { backgroundColor: c.backgroundElement }]}
            >
              <SymbolView name="xmark" size={13} tintColor={c.text} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.analyticsSummary}>
              <View>
                <Text
                  style={[s.analyticsCurrentLabel, { color: c.textSecondary }]}
                >
                  LATEST
                </Text>
                <Text style={[s.analyticsCurrent, { color: c.text }]}>
                  {latest ? format(latest.value) : "—"}
                  <Text style={s.analyticsCurrentUnit}> kg</Text>
                </Text>
              </View>
              <View
                style={[s.analyticsChange, { backgroundColor: c.brandSoft }]}
              >
                <Text style={[s.analyticsChangeValue, { color: c.brand }]}>
                  {change === null
                    ? "FIRST READING"
                    : `${change <= 0 ? "↓" : "↑"} ${format(Math.abs(change))} kg`}
                </Text>
                <Text
                  style={[s.analyticsChangeLabel, { color: c.textSecondary }]}
                >
                  PERIOD CHANGE
                </Text>
              </View>
            </View>
            <View
              style={[
                s.lineChartCard,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <View
                style={[
                  s.lineChart,
                  { width: chartWidth, height: chartHeight },
                ]}
              >
                {[0, 1, 2, 3].map((line) => (
                  <View
                    key={line}
                    style={[
                      s.chartGridLine,
                      { top: 12 + line * 45, backgroundColor: c.border },
                    ]}
                  />
                ))}
                {coords.slice(0, -1).map((coord, index) => {
                  const next = coords[index + 1];
                  const dx = next.x - coord.x;
                  const dy = next.y - coord.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = `${Math.atan2(dy, dx)}rad`;
                  return (
                    <View
                      key={`${coord.point.id}-line`}
                      style={[
                        s.chartSegment,
                        {
                          backgroundColor: c.brand,
                          width: length,
                          left: (coord.x + next.x - length) / 2,
                          top: (coord.y + next.y) / 2,
                          transform: [{ rotate: angle }],
                        },
                      ]}
                    />
                  );
                })}
                {coords.map((coord, index) => (
                  <View
                    key={coord.point.id}
                    style={[
                      s.chartDot,
                      {
                        backgroundColor: c.brand,
                        borderColor: c.surface,
                        left: coord.x - 5,
                        top: coord.y - 5,
                      },
                    ]}
                  >
                    {index === coords.length - 1 ? (
                      <View style={s.chartDotCore} />
                    ) : null}
                  </View>
                ))}
                {!points.length ? (
                  <Text style={[s.chartEmpty, { color: c.textSecondary }]}>
                    Add two weight readings to build your trend.
                  </Text>
                ) : null}
              </View>
              {points.length ? (
                <View style={s.chartAxis}>
                  <Text style={[s.chartAxisText, { color: c.textSecondary }]}>
                    {new Date(points[0].recordedAt).toLocaleDateString([], {
                      day: "numeric",
                      month: "short",
                    })}
                  </Text>
                  <Text style={[s.chartAxisText, { color: c.textSecondary }]}>
                    {new Date(latest!.recordedAt).toLocaleDateString([], {
                      day: "numeric",
                      month: "short",
                    })}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={s.analyticsStats}>
              <AnalyticsStat
                colors={c}
                label="LOW"
                value={points.length ? `${format(low)} kg` : "—"}
              />
              <AnalyticsStat
                colors={c}
                label="HIGH"
                value={points.length ? `${format(high)} kg` : "—"}
              />
              <AnalyticsStat
                colors={c}
                label="READINGS"
                value={`${points.length}`}
              />
            </View>
            <View style={s.analyticsHistoryHead}>
              <Text style={[s.analyticsHistoryTitle, { color: c.text }]}>
                Measurement history
              </Text>
              <Pressable onPress={onManual}>
                <Text style={[s.textLink, { color: c.brand }]}>+ MANUAL</Text>
              </Pressable>
            </View>
            {points
              .slice()
              .reverse()
              .slice(0, 8)
              .map((point) => (
                <View
                  key={`${point.id}-history`}
                  style={[s.analyticsHistoryRow, { borderColor: c.border }]}
                >
                  <View
                    style={[
                      s.analyticsHistoryDot,
                      { backgroundColor: c.brandSoft },
                    ]}
                  >
                    <SymbolView
                      name={
                        point.source === "smart-scale"
                          ? "scalemass.fill"
                          : "hand.tap.fill"
                      }
                      size={13}
                      tintColor={c.brand}
                    />
                  </View>
                  <View style={s.analyticsHistoryCopy}>
                    <Text style={[s.analyticsHistorySource, { color: c.text }]}>
                      {sourceLabel(point.source)}
                    </Text>
                    <Text
                      style={[
                        s.analyticsHistoryDate,
                        { color: c.textSecondary },
                      ]}
                    >
                      {new Date(point.recordedAt).toLocaleString([], {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <Text style={[s.analyticsHistoryValue, { color: c.text }]}>
                    {format(point.value)} kg
                  </Text>
                </View>
              ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AnalyticsStat({
  colors: c,
  label,
  value,
}: {
  colors: Theme;
  label: string;
  value: string;
}) {
  return (
    <View
      style={[
        s.analyticsStat,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <Text style={[s.analyticsStatLabel, { color: c.textSecondary }]}>
        {label}
      </Text>
      <Text style={[s.analyticsStatValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

function ReviewStat({
  colors: c,
  label,
  value,
}: {
  colors: Theme;
  label: string;
  value: string;
}) {
  return (
    <View style={[s.reviewStat, { backgroundColor: c.backgroundElement }]}>
      <Text style={[s.reviewStatLabel, { color: c.textSecondary }]}>
        {label}
      </Text>
      <Text style={[s.reviewStatValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

function MedicinePlanSheet({
  visible,
  colors: c,
  bottomInset,
  onClose,
  onSaved,
}: {
  visible: boolean;
  colors: Theme;
  bottomInset: number;
  onClose: () => void;
  onSaved: (plan: MedicinePlan) => void;
}) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [duration, setDuration] = useState<"ongoing" | "7" | "30">("ongoing");
  const [savingPlan, setSavingPlan] = useState(false);
  const [planError, setPlanError] = useState("");
  const timeChoices = ["08:00", "13:00", "20:00"];

  async function savePlan() {
    if (name.trim().length < 2) {
      setPlanError("Add the medicine name first.");
      return;
    }
    if (!times.length) {
      setPlanError("Choose at least one reminder time.");
      return;
    }
    setSavingPlan(true);
    setPlanError("");
    try {
      const startDate = new Date();
      const endDate =
        duration === "ongoing"
          ? null
          : new Date(Date.now() + Number(duration) * DAY);
      const plan = await createMedicinePlan({
        name: name.trim(),
        dose: dose.trim() || null,
        times,
        startDate: startDate.toISOString(),
        endDate: endDate?.toISOString() ?? null,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setName("");
      setDose("");
      setTimes(["08:00"]);
      setDuration("ongoing");
      onSaved(plan);
    } catch (cause) {
      setPlanError(
        cause instanceof Error
          ? cause.message
          : "Could not save this medicine plan.",
      );
    } finally {
      setSavingPlan(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[
              s.medicineSheet,
              {
                backgroundColor: c.background,
                paddingBottom: Math.max(bottomInset, 20),
              },
            ]}
          >
            <View style={[s.handle, { backgroundColor: c.border }]} />
            <View style={s.sheetHead}>
              <View style={s.sheetTitleRow}>
                <View
                  style={[s.sheetEntryIcon, { backgroundColor: c.brandSoft }]}
                >
                  <SymbolView name="pills.fill" size={18} tintColor={c.brand} />
                </View>
                <View>
                  <Text style={[s.sheetEyebrow, { color: c.brand }]}>
                    OPTIONAL WELLNESS PLAN
                  </Text>
                  <Text style={[s.sheetTitle, { color: c.text }]}>
                    Medicine reminders
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={onClose}
                style={[s.close, { backgroundColor: c.backgroundElement }]}
              >
                <SymbolView name="xmark" size={13} tintColor={c.text} />
              </Pressable>
            </View>
            <Text style={[s.medicineSheetIntro, { color: c.textSecondary }]}>
              Only add a plan if you take medicine regularly. KASA will remind
              you at the times you choose.
            </Text>
            <View
              style={[
                s.medicineField,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text style={[s.inputLabel, { color: c.textSecondary }]}>
                MEDICINE NAME
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Vitamin D"
                placeholderTextColor={c.textSecondary}
                style={[s.input, { color: c.text }]}
              />
            </View>
            <View
              style={[
                s.medicineField,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text style={[s.inputLabel, { color: c.textSecondary }]}>
                DOSE · OPTIONAL
              </Text>
              <TextInput
                value={dose}
                onChangeText={setDose}
                placeholder="e.g. 1 tablet after dinner"
                placeholderTextColor={c.textSecondary}
                style={[s.input, { color: c.text }]}
              />
            </View>
            <Text style={[s.medicineFieldLabel, { color: c.textSecondary }]}>
              REMIND ME AT
            </Text>
            <View style={s.timeChoices}>
              {timeChoices.map((time) => {
                const selected = times.includes(time);
                return (
                  <Pressable
                    key={time}
                    onPress={() =>
                      setTimes((current) =>
                        selected
                          ? current.filter((item) => item !== time)
                          : [...current, time].sort(),
                      )
                    }
                    style={[
                      s.timeChoice,
                      {
                        backgroundColor: selected ? c.brand : c.surface,
                        borderColor: selected ? c.brand : c.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.timeChoiceText,
                        { color: selected ? "#FFFFFF" : c.text },
                      ]}
                    >
                      {time}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[s.medicineFieldLabel, { color: c.textSecondary }]}>
              STARTS TODAY · FOR
            </Text>
            <View style={s.durationChoices}>
              {(["ongoing", "7", "30"] as const).map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setDuration(item)}
                  style={[
                    s.durationChoice,
                    {
                      backgroundColor:
                        duration === item ? c.brandSoft : c.surface,
                      borderColor: duration === item ? c.brand : c.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.durationChoiceText,
                      { color: duration === item ? c.brand : c.textSecondary },
                    ]}
                  >
                    {item === "ongoing" ? "Ongoing" : `${item} days`}
                  </Text>
                </Pressable>
              ))}
            </View>
            {planError ? (
              <Text style={[s.sheetError, { color: c.brand }]}>
                {planError}
              </Text>
            ) : null}
            <Pressable
              disabled={savingPlan}
              onPress={() => void savePlan()}
              style={[
                s.saveButton,
                { backgroundColor: c.brand, opacity: savingPlan ? 0.7 : 1 },
              ]}
            >
              {savingPlan ? (
                <KasaSpinner color="#FFFFFF" size={19} />
              ) : (
                <>
                  <SymbolView
                    name="bell.badge.fill"
                    size={14}
                    tintColor="#FFFFFF"
                  />
                  <Text style={s.saveText}>Start reminders</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function CategoryContent({
  section,
  entries,
  openEntry,
  medicinePlans,
  openMedicinePlan,
  colors: c,
}: {
  section: Exclude<Section, "today">;
  entries: HealthEntry[];
  openEntry: (type: HealthEntryType) => void;
  medicinePlans: MedicinePlan[];
  openMedicinePlan: () => void;
  colors: Theme;
}) {
  const configs: Record<
    Exclude<Section, "today">,
    { title: string; description: string; icon: SymbolName }
  > = {
    measurements: {
      title: "Measurements",
      description: "Numbers that show change over time.",
      icon: "waveform.path.ecg",
    },
    activities: {
      title: "Activities",
      description: "Movement and mindfulness events.",
      icon: "figure.run",
    },
    wellness: {
      title: "Wellness",
      description: "Daily care, reminders and behavior.",
      icon: "sun.max.fill",
    },
  };
  const config = configs[section];
  const available = options.filter((item) => item.section === section);
  const recent = entries
    .filter((entry) => available.some((item) => item.type === entry.type))
    .slice(0, 8);
  return (
    <>
      {section === "wellness" ? (
        <Pressable
          onPress={openMedicinePlan}
          style={({ pressed }) => [
            s.medicinePlanCard,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <View style={[s.medicinePlanIcon, { backgroundColor: c.brandSoft }]}>
            <SymbolView name="pills.fill" size={18} tintColor={c.brand} />
          </View>
          <View style={s.medicinePlanCopy}>
            <Text style={[s.medicinePlanTitle, { color: c.text }]}>
              Medicine plan
            </Text>
            <Text
              numberOfLines={2}
              style={[s.medicinePlanText, { color: c.textSecondary }]}
            >
              {medicinePlans.length
                ? `${medicinePlans.length} active plan${medicinePlans.length === 1 ? "" : "s"} · ${medicinePlans[0]?.name} at ${medicinePlans[0]?.times.join(", ")}`
                : "Only set this up if you take a medicine regularly."}
            </Text>
          </View>
          <View style={[s.medicinePlanAction, { backgroundColor: c.brand }]}>
            <SymbolView
              name={medicinePlans.length ? "slider.horizontal.3" : "plus"}
              size={13}
              tintColor="#FFFFFF"
            />
          </View>
        </Pressable>
      ) : null}
      <View style={s.categoryHeroShadow}>
        <View style={s.categoryHeroClip}>
          <LinearGradient
            colors={[c.brand, c.brandStrong]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.categoryHero}
          >
            <View style={s.categoryOrb} />
            <View style={s.categoryHeroTop}>
              <View style={s.categoryIcon}>
                <SymbolView name={config.icon} size={22} tintColor="#FFFFFF" />
              </View>
              <View style={s.categoryBadge}>
                <Text style={s.categoryBadgeText}>
                  {available.length} TRACKERS
                </Text>
              </View>
            </View>
            <Text style={s.categoryTitle}>{config.title}</Text>
            <Text style={s.categoryText}>{config.description}</Text>
          </LinearGradient>
        </View>
      </View>
      <View style={s.catalogueGrid}>
        {catalogue[section].map((label, index) => {
          const match = available.find(
            (item) => item.label.toLowerCase() === label.toLowerCase(),
          );
          const fallback = available[index % available.length];
          return (
            <Pressable
              key={label}
              disabled={!match}
              onPress={() => match && openEntry(match.type)}
              style={({ pressed }) => [
                s.catalogueItem,
                {
                  backgroundColor: c.surface,
                  borderColor: c.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View
                style={[
                  s.catalogueIcon,
                  { backgroundColor: c.backgroundElement },
                ]}
              >
                <SymbolView
                  name={(match ?? fallback).icon}
                  size={16}
                  tintColor={c.brand}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[s.catalogueLabel, { color: c.text }]}
              >
                {label}
              </Text>
              {match ? (
                <SymbolView name="plus" size={11} tintColor={c.textSecondary} />
              ) : (
                <Text style={[s.soon, { color: c.textSecondary }]}>SOON</Text>
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={s.sectionHead}>
        <View>
          <Text style={[s.sectionTitle, { color: c.text }]}>
            Recent entries
          </Text>
          <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
            Manual and connected sources together
          </Text>
        </View>
      </View>
      <View
        style={[
          s.history,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        {recent.length ? (
          recent.map((entry, index) => {
            const item = options.find((option) => option.type === entry.type);
            return (
              <View
                key={entry.id}
                style={[
                  s.historyRow,
                  index > 0 && { borderTopColor: c.border, borderTopWidth: 1 },
                ]}
              >
                <View
                  style={[
                    s.historyIcon,
                    { backgroundColor: c.backgroundElement },
                  ]}
                >
                  <SymbolView
                    name={item?.icon ?? config.icon}
                    size={15}
                    tintColor={c.brand}
                  />
                </View>
                <View style={s.historyCopy}>
                  <Text style={[s.historyTitle, { color: c.text }]}>
                    {item?.label ?? entry.type}
                  </Text>
                  <Text style={[s.historyMeta, { color: c.textSecondary }]}>
                    {entry.source === "smart-scale"
                      ? "Smart Scale"
                      : "Manual entry"}{" "}
                    ·{" "}
                    {new Intl.DateTimeFormat("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(entry.recordedAt))}
                  </Text>
                </View>
                <Text style={[s.historyValue, { color: c.text }]}>
                  {format(entry.value)}{" "}
                  <Text style={[s.historyUnit, { color: c.textSecondary }]}>
                    {entry.unit}
                  </Text>
                </Text>
              </View>
            );
          })
        ) : (
          <View style={s.empty}>
            <SymbolView
              name={config.icon}
              size={23}
              tintColor={c.textSecondary}
            />
            <Text style={[s.emptyTitle, { color: c.text }]}>
              No entries yet
            </Text>
            <Text style={[s.emptyText, { color: c.textSecondary }]}>
              Your history will stay calm and readable here.
            </Text>
          </View>
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" },
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 140 },
  headingRow: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  headingCopy: { flex: 1 },
  headingActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  eyebrow: { fontSize: 8, fontWeight: "900", letterSpacing: 1.35 },
  title: {
    fontSize: 31,
    lineHeight: 37,
    fontWeight: "900",
    letterSpacing: -1.45,
    marginTop: 5,
  },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  addButton: {
    width: 49,
    height: 49,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 25px rgba(223,60,13,0.22)",
  },
  sourceButton: {
    width: 43,
    height: 43,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    height: 47,
    borderRadius: 20,
    borderWidth: 1,
    padding: 4,
    flexDirection: "row",
    marginTop: 20,
  },
  tab: {
    flex: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { fontSize: 9, fontWeight: "800" },
  pageError: { fontSize: 11, fontWeight: "700", marginTop: 12 },
  loading: { minHeight: 320, alignItems: "center", justifyContent: "center" },
  todayBodyShadow: {
    borderRadius: 30,
    marginTop: 14,
    boxShadow: "0 18px 40px rgba(223,60,13,0.22)",
  },
  todayBodyClip: { borderRadius: 30, overflow: "hidden" },
  todayBodyHero: { minHeight: 190, padding: 20, overflow: "hidden" },
  todayBodyOrb: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: "rgba(255,255,255,0.10)",
    right: -60,
    top: -75,
  },
  todayHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  todayHeroEyebrow: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.15,
  },
  todayHeroValue: {
    color: "#FFFFFF",
    fontSize: 48,
    lineHeight: 56,
    fontWeight: "900",
    letterSpacing: -2.4,
    marginTop: 8,
  },
  todayHeroUnit: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  todayHeroSource: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 8,
    fontWeight: "700",
    marginTop: 3,
  },
  todayTrendPill: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 9,
    alignItems: "flex-end",
  },
  todayTrendValue: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  todayTrendLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 0.65,
    marginTop: 2,
  },
  todayHeroFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 25,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.22)",
  },
  todayHeroFooterText: {
    color: "rgba(255,255,255,0.82)",
    flex: 1,
    fontSize: 8.5,
    fontWeight: "700",
  },
  textLink: { fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  bodySnapshotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  bodySnapshotCard: {
    width: "48.6%",
    minHeight: 125,
    borderRadius: 22,
    borderWidth: 1,
    padding: 13,
  },
  bodySnapshotIcon: {
    width: 31,
    height: 31,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  bodySnapshotLabel: { fontSize: 8, fontWeight: "700", marginTop: 10 },
  bodySnapshotValue: {
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.65,
    marginTop: 2,
  },
  bodySnapshotUnit: { fontSize: 8, fontWeight: "700" },
  bodySnapshotSource: { fontSize: 7, fontWeight: "800", marginTop: 5 },
  bodySnapshotInsight: { fontSize: 6, fontWeight: "900", marginTop: 4 },
  dailyRhythm: {
    borderWidth: 1,
    borderRadius: 25,
    overflow: "hidden",
    paddingHorizontal: 12,
  },
  dailySignal: { minHeight: 70, flexDirection: "row", alignItems: "center" },
  dailySignalIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  dailySignalCopy: { flex: 1, marginHorizontal: 10 },
  dailySignalTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dailySignalLabel: { fontSize: 9, fontWeight: "800" },
  dailySignalValue: { fontSize: 10, fontWeight: "900" },
  dailySignalTrack: {
    height: 5,
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 7,
  },
  dailySignalFill: { height: 5, borderRadius: 5 },
  dailySignalAction: {
    minWidth: 48,
    height: 29,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  dailySignalActionText: { fontSize: 7, fontWeight: "900" },
  measureOverviewShadow: {
    borderRadius: 30,
    marginTop: 14,
    boxShadow: "0 16px 36px rgba(223,60,13,0.20)",
  },
  measureOverview: { borderRadius: 30, padding: 20, overflow: "hidden" },
  measureOverviewTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  measureOverviewEyebrow: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  measureOverviewTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1.2,
    marginTop: 6,
  },
  measureOverviewMeta: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 8,
    marginTop: 4,
    maxWidth: 250,
  },
  measureSourceButton: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  measureOverviewStats: { flexDirection: "row", gap: 7, marginTop: 18 },
  measureHeroStat: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  measureHeroStatLabel: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 0.65,
  },
  measureHeroStatValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 3,
  },
  focusPanel: { borderRadius: 23, padding: 13, marginBottom: 10 },
  focusPanelHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 7,
  },
  focusPanelTitle: { fontSize: 12, fontWeight: "900" },
  focusRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(223,60,13,0.12)",
    paddingVertical: 8,
  },
  focusCopy: { flex: 1 },
  focusName: { fontSize: 9, fontWeight: "900" },
  focusMessage: { fontSize: 7.5, lineHeight: 11, marginTop: 2 },
  measurementGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  measurementTile: {
    width: "48.6%",
    minHeight: 184,
    borderWidth: 1,
    borderRadius: 22,
    padding: 13,
  },
  measurementTileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  measurementTileIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  measurementAdd: {
    width: 27,
    height: 27,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  measurementTileLabel: { fontSize: 8, fontWeight: "700", marginTop: 10 },
  measurementTileValue: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginTop: 2,
  },
  measurementTileUnit: { fontSize: 8, fontWeight: "700" },
  measurementSourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 7,
  },
  measurementSourceDot: { width: 5, height: 5, borderRadius: 3 },
  measurementSource: { flex: 1, fontSize: 7, fontWeight: "800" },
  rangeBlock: { marginTop: 8 },
  rangeCompactRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  rangeCompactDot: { width: 6, height: 6, borderRadius: 3 },
  rangeTap: { fontSize: 6, fontWeight: "900", letterSpacing: 0.7 },
  rangeTop: {
    minHeight: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  rangeStatus: { flex: 1, fontSize: 6, fontWeight: "900", letterSpacing: 0.45 },
  rangeValue: { fontSize: 5.5, fontWeight: "700", textAlign: "right" },
  rangeTrack: {
    height: 5,
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 5,
    position: "relative",
  },
  rangeBand: {
    position: "absolute",
    left: "22%",
    right: "22%",
    top: 0,
    bottom: 0,
    borderRadius: 5,
  },
  rangeMarker: {
    position: "absolute",
    top: -2,
    width: 4,
    height: 9,
    borderRadius: 3,
    marginLeft: -2,
  },
  rangeMessage: { fontSize: 6.5, lineHeight: 9.5, marginTop: 6 },
  insightSheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    paddingHorizontal: 20,
    paddingTop: 10,
    boxShadow: "0 -16px 50px rgba(20,7,2,0.25)",
  },
  insightHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  insightIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitleCopy: { flex: 1, marginLeft: 10 },
  insightTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 2,
  },
  insightValueCard: { borderWidth: 1, borderRadius: 23, padding: 15 },
  insightYourValue: { fontSize: 7, fontWeight: "900", letterSpacing: 0.9 },
  insightNumber: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 4,
  },
  insightUnit: { fontSize: 12, fontWeight: "800" },
  insightStatePill: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  insightStateDot: { width: 6, height: 6, borderRadius: 3 },
  insightStateText: { fontSize: 7, fontWeight: "900", letterSpacing: 0.65 },
  spectrumCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    marginTop: 10,
  },
  spectrumLabel: { fontSize: 7, fontWeight: "900", letterSpacing: 0.6 },
  spectrumTrack: {
    height: 11,
    borderRadius: 6,
    overflow: "visible",
    flexDirection: "row",
    marginTop: 12,
  },
  spectrumSegment: { height: 11 },
  spectrumPointer: {
    position: "absolute",
    top: -5,
    width: 19,
    height: 21,
    borderRadius: 11,
    borderWidth: 3,
    backgroundColor: "#FFFFFF",
    marginLeft: -9.5,
  },
  spectrumLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 9,
  },
  spectrumLegendText: { fontSize: 7, fontWeight: "700" },
  insightDescription: { borderRadius: 21, padding: 14, marginTop: 10 },
  insightDescriptionTitle: { fontSize: 12, fontWeight: "900" },
  insightDescriptionText: { fontSize: 10, lineHeight: 15, marginTop: 5 },
  insightAction: {
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 13,
    marginTop: 9,
  },
  insightSource: {
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
  },
  insightEmpty: { borderWidth: 1, borderRadius: 22, padding: 16 },
  insightManualButton: {
    minHeight: 49,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    marginTop: 14,
  },
  insightManualText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  insightSafety: {
    fontSize: 7.5,
    lineHeight: 11,
    textAlign: "center",
    marginTop: 11,
  },
  measureTimeline: { borderWidth: 1, borderRadius: 25, overflow: "hidden" },
  measureTimelineRow: {
    minHeight: 64,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  measureTimelineIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  measureTimelineCopy: { flex: 1, marginLeft: 10 },
  measureTimelineTitle: { fontSize: 10, fontWeight: "800" },
  measureTimelineMeta: { fontSize: 7, marginTop: 3 },
  measureTimelineValue: { fontSize: 11, fontWeight: "900" },
  measureTimelineUnit: { fontSize: 7, fontWeight: "600" },
  scoreCardShadow: {
    borderRadius: 30,
    marginTop: 14,
    boxShadow: "0 18px 40px rgba(223,60,13,0.22)",
  },
  scoreCardClip: { borderRadius: 30, overflow: "hidden" },
  scoreCard: { padding: 21, overflow: "hidden" },
  scoreOrb: {
    position: "absolute",
    width: 165,
    height: 165,
    borderRadius: 165,
    backgroundColor: "rgba(255,255,255,0.10)",
    right: -52,
    top: -72,
  },
  scoreRing: {
    position: "absolute",
    width: 105,
    height: 105,
    borderRadius: 105,
    borderWidth: 20,
    borderColor: "rgba(255,255,255,0.07)",
    left: -48,
    bottom: -63,
  },
  scoreTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  scoreLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  scoreValue: {
    color: "#FFFFFF",
    fontSize: 50,
    lineHeight: 58,
    fontWeight: "900",
    letterSpacing: -2.8,
    marginTop: 7,
  },
  scoreUnit: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 17,
    letterSpacing: -0.4,
  },
  scoreSignalPill: {
    minHeight: 49,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  scoreSignalValue: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  scoreSignalLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 6,
    fontWeight: "800",
    letterSpacing: 0.65,
    marginTop: 2,
  },
  scoreTrack: {
    height: 6,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.20)",
    marginTop: 14,
  },
  scoreFill: { height: "100%", borderRadius: 6, backgroundColor: "#FFFFFF" },
  scoreMessage: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 10,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 26,
    marginBottom: 11,
  },
  sectionTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.55 },
  sectionMeta: { fontSize: 9, marginTop: 3 },
  datePill: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  weightTrend: {
    borderWidth: 1,
    borderRadius: 27,
    padding: 16,
    marginTop: 10,
    boxShadow: "0 7px 22px rgba(55,23,11,0.04)",
  },
  weightTrendHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weightTrendEyebrow: { fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  weightTrendValue: {
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 3,
  },
  weightTrendUnit: { fontSize: 10, fontWeight: "700" },
  weightTrendChange: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 11,
  },
  weightTrendEmpty: { fontSize: 9, lineHeight: 14, marginTop: 13 },
  weightChart: {
    height: 78,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  weightChartColumn: {
    flex: 1,
    height: 70,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  weightChartBar: { width: "62%", minWidth: 8, borderRadius: 8 },
  weightChartDates: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
  },
  weightChartDate: { fontSize: 7, fontWeight: "700" },
  tracker: {
    width: "48.5%",
    minHeight: 190,
    borderWidth: 1,
    borderRadius: 27,
    padding: 15,
    boxShadow: "0 7px 22px rgba(55,23,11,0.04)",
  },
  trackerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trackerIcon: {
    width: 39,
    height: 39,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  trackerAction: {
    width: 31,
    height: 31,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  trackerLabel: { fontSize: 9, fontWeight: "700", marginTop: 13 },
  trackerValue: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 2,
  },
  trackerDetail: { fontSize: 7.5, marginTop: 2 },
  progressMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 11,
  },
  progressLabel: { fontSize: 6, fontWeight: "900", letterSpacing: 0.6 },
  progressValue: { fontSize: 8, fontWeight: "900" },
  track: { height: 7, borderRadius: 7, overflow: "hidden", marginTop: 5 },
  fill: { height: 7, borderRadius: 7 },
  quickRow: { flexDirection: "row", gap: 5, marginTop: 10 },
  quickButton: {
    flex: 1,
    height: 28,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  quickText: { fontSize: 7, fontWeight: "800" },
  medicineCard: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 26,
    marginTop: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  medicineIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  medicineCopy: { flex: 1, marginLeft: 11 },
  medicineTitle: { fontSize: 14, fontWeight: "900" },
  medicineDetail: { fontSize: 9, marginTop: 3 },
  medicineStatus: {
    width: 33,
    height: 33,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  medicinePlanCard: {
    minHeight: 82,
    borderRadius: 24,
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  medicinePlanIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  medicinePlanCopy: { flex: 1, marginLeft: 11 },
  medicinePlanTitle: { fontSize: 13, fontWeight: "900" },
  medicinePlanText: { fontSize: 8, lineHeight: 12, marginTop: 3 },
  medicinePlanAction: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  medicineSheet: {
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    paddingHorizontal: 20,
    paddingTop: 10,
    boxShadow: "0 -16px 50px rgba(20,7,2,0.25)",
  },
  medicineSheetIntro: {
    fontSize: 9,
    lineHeight: 14,
    marginTop: -6,
    marginBottom: 12,
  },
  medicineField: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingTop: 8,
    marginBottom: 9,
  },
  medicineFieldLabel: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginTop: 5,
    marginBottom: 7,
  },
  timeChoices: { flexDirection: "row", gap: 8 },
  timeChoice: {
    flex: 1,
    height: 43,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timeChoiceText: { fontSize: 11, fontWeight: "900" },
  durationChoices: { flexDirection: "row", gap: 8, marginBottom: 9 },
  durationChoice: {
    flex: 1,
    height: 39,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  durationChoiceText: { fontSize: 9, fontWeight: "900" },
  coachCard: { borderWidth: 1, borderRadius: 28, marginTop: 22, padding: 16 },
  coachTop: { flexDirection: "row", alignItems: "center" },
  coachIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  coachCopy: { marginLeft: 10 },
  coachLabel: { fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  coachTitle: { fontSize: 16, fontWeight: "900", marginTop: 2 },
  nudge: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderRadius: 17,
    marginTop: 13,
  },
  nudgeEmoji: { fontSize: 22 },
  nudgeText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
    marginLeft: 10,
  },
  coachNote: { fontSize: 8, marginTop: 10 },
  reviewCard: { borderWidth: 1, borderRadius: 28, marginTop: 12, padding: 16 },
  reviewHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewLabel: { fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  reviewTitle: { fontSize: 18, fontWeight: "900", marginTop: 2 },
  reviewRange: {
    fontSize: 7,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
  },
  reviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    marginTop: 13,
  },
  reviewStat: { width: "48.5%", borderRadius: 18, padding: 11 },
  reviewStatLabel: { fontSize: 8 },
  reviewStatValue: { fontSize: 13, fontWeight: "900", marginTop: 4 },
  categoryHeroShadow: {
    borderRadius: 36,
    marginTop: 14,
    boxShadow: "0 16px 34px rgba(223,60,13,0.18)",
  },
  categoryHeroClip: { borderRadius: 36, overflow: "hidden" },
  categoryHero: { padding: 20, overflow: "hidden" },
  categoryOrb: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 160,
    backgroundColor: "rgba(255,255,255,0.09)",
    right: -54,
    top: -74,
  },
  categoryHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryIcon: {
    width: 47,
    height: 47,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  categoryBadge: {
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  categoryBadgeText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  categoryTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 15,
  },
  categoryText: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 11,
    marginTop: 4,
  },
  catalogueGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    marginTop: 12,
  },
  catalogueItem: {
    width: "48.5%",
    height: 55,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
  },
  catalogueIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  catalogueLabel: { flex: 1, fontSize: 9, fontWeight: "800", marginLeft: 8 },
  soon: { fontSize: 6, fontWeight: "900" },
  history: { borderWidth: 1, borderRadius: 27, overflow: "hidden" },
  historyRow: {
    minHeight: 65,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  historyIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  historyCopy: { flex: 1, marginLeft: 10 },
  historyTitle: { fontSize: 11, fontWeight: "800" },
  historyMeta: { fontSize: 7.5, marginTop: 3 },
  historyValue: { fontSize: 12, fontWeight: "900" },
  historyUnit: { fontSize: 7, fontWeight: "500" },
  empty: {
    minHeight: 170,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: { fontSize: 15, fontWeight: "900", marginTop: 10 },
  emptyText: { fontSize: 9, textAlign: "center", marginTop: 4 },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(20,9,5,0.48)",
  },
  analyticsSheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 20,
    paddingTop: 10,
    boxShadow: "0 -16px 50px rgba(20,7,2,0.25)",
  },
  analyticsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  analyticsEyebrow: { fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  analyticsTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.9,
    marginTop: 3,
  },
  analyticsSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
  },
  analyticsCurrentLabel: { fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  analyticsCurrent: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -1.3,
  },
  analyticsCurrentUnit: { fontSize: 12, fontWeight: "700" },
  analyticsChange: {
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 8,
    alignItems: "flex-end",
  },
  analyticsChangeValue: { fontSize: 9, fontWeight: "900" },
  analyticsChangeLabel: {
    fontSize: 6,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  lineChartCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 12,
    overflow: "hidden",
  },
  lineChart: { position: "relative", alignSelf: "center", overflow: "hidden" },
  chartGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.7,
  },
  chartSegment: { position: "absolute", height: 3, borderRadius: 3 },
  chartDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  chartDotCore: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  chartEmpty: { textAlign: "center", marginTop: 70, fontSize: 9 },
  chartAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: 2,
  },
  chartAxisText: { fontSize: 7, fontWeight: "700" },
  analyticsStats: { flexDirection: "row", gap: 8, marginTop: 10 },
  analyticsStat: { flex: 1, borderWidth: 1, borderRadius: 17, padding: 11 },
  analyticsStatLabel: { fontSize: 6, fontWeight: "900", letterSpacing: 0.7 },
  analyticsStatValue: { fontSize: 12, fontWeight: "900", marginTop: 4 },
  analyticsHistoryHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 9,
  },
  analyticsHistoryTitle: { fontSize: 16, fontWeight: "900" },
  analyticsHistoryRow: {
    minHeight: 62,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  analyticsHistoryDot: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  analyticsHistoryCopy: { flex: 1, marginLeft: 10 },
  analyticsHistorySource: { fontSize: 10, fontWeight: "800" },
  analyticsHistoryDate: { fontSize: 7, marginTop: 3 },
  analyticsHistoryValue: { fontSize: 12, fontWeight: "900" },
  sheet: {
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    paddingHorizontal: 20,
    paddingTop: 10,
    boxShadow: "0 -16px 50px rgba(20,7,2,0.25)",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  sheetEntryIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetEyebrow: { fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  sheetTitle: {
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 3,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 10,
    marginBottom: 9,
  },
  inputLabel: { fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  input: { height: 37, fontSize: 14, fontWeight: "700" },
  valueRow: { flexDirection: "row", alignItems: "center" },
  valueInput: { flex: 1, height: 51, fontSize: 25, fontWeight: "900" },
  unit: { fontSize: 11, fontWeight: "700" },
  quickValueRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 3,
    marginBottom: 6,
  },
  quickValue: {
    minHeight: 29,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  quickValueText: { fontSize: 8, fontWeight: "900" },
  sheetError: { fontSize: 10, fontWeight: "700", marginBottom: 8 },
  saveButton: {
    height: 51,
    borderRadius: 21,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  saveText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  sourceNote: { fontSize: 8, textAlign: "center", marginTop: 10 },
});
