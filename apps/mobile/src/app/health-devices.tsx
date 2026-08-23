import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import BleManager, {
  type BleManagerDidUpdateValueForCharacteristicEvent,
} from "react-native-ble-manager";
import { SafeAreaView } from "react-native-safe-area-context";

import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { createHealthEntries, listHealthEntries } from "@/lib/health";
import {
  deriveBodyComposition,
  type BodyCompositionProfile,
} from "@/lib/health-sources/body-composition";
import {
  normalizeScaleMetrics,
  packetHex,
  parseSmartScalePacket,
  scaleDevice,
  shortUuid,
  startScaleBluetooth,
  type ScaleDevice,
  type ScalePacket,
} from "@/lib/health-sources/smart-scale";
import type { HealthSourceMeasurement } from "@/lib/health-sources/types";
import { getProfileDetails } from "@/lib/profile-details";

type ConnectionState =
  "idle" | "scanning" | "connecting" | "connected" | "sleeping";

const labels: Record<HealthSourceMeasurement["type"], string> = {
  weight: "Weight",
  height: "Height",
  bmi: "BMI",
  bloodPressureSystolic: "BP systolic",
  bloodPressureDiastolic: "BP diastolic",
  bloodSugar: "Blood sugar",
  heartRate: "Heart rate",
  spo2: "SpO₂",
  bodyFat: "Body fat",
  fatMass: "Fat mass",
  muscleMass: "Muscle mass",
  musclePercentage: "Muscle",
  skeletalMuscleMass: "Skeletal muscle",
  bodyWaterMass: "Body water",
  bodyWaterPercentage: "Body water",
  fatFreeMass: "Fat-free mass",
  leanMass: "Lean mass",
  visceralFat: "Visceral fat",
  subcutaneousFat: "Subcutaneous fat",
  boneMass: "Bone mass",
  proteinMass: "Protein mass",
  proteinPercentage: "Protein",
  basalMetabolism: "Basal metabolism",
  bodyAge: "Body age",
  idealWeight: "Ideal weight",
  bodyScore: "Body score",
  impedance: "Impedance",
  temperature: "Temperature",
  water: "Water",
  sleep: "Sleep",
  steps: "Steps",
  medicine: "Medicine",
  standUp: "Stand up",
  eyeRest: "Eye rest",
  breathing: "Breathing",
  sunlight: "Sunlight",
  healthyMeal: "Healthy meal",
  walk: "Walk",
  run: "Run",
  cycling: "Cycling",
  gym: "Gym",
  yoga: "Yoga",
  swimming: "Swimming",
  meditation: "Meditation",
  stretching: "Stretching",
};

const highlightTypes: HealthSourceMeasurement["type"][] = [
  "bmi",
  "bodyFat",
  "musclePercentage",
  "bodyWaterPercentage",
];

const metricIcons: Partial<
  Record<
    HealthSourceMeasurement["type"],
    ComponentProps<typeof SymbolView>["name"]
  >
> = {
  bmi: "figure.stand",
  bodyFat: "drop.fill",
  musclePercentage: "figure.strengthtraining.traditional",
  bodyWaterPercentage: "waterbottle.fill",
  fatMass: "circle.grid.2x2.fill",
  fatFreeMass: "figure.arms.open",
  muscleMass: "figure.strengthtraining.traditional",
  skeletalMuscleMass: "figure.walk",
  bodyWaterMass: "drop.fill",
  boneMass: "waveform.path.ecg",
  proteinMass: "leaf.fill",
  proteinPercentage: "leaf.fill",
  basalMetabolism: "flame.fill",
  idealWeight: "scope",
  impedance: "bolt.fill",
};

function metricProgress(item: HealthSourceMeasurement, weight: number) {
  if (item.unit === "%") return Math.min(1, item.value / 100);
  if (item.type === "bmi") return Math.min(1, item.value / 30);
  if (item.type === "basalMetabolism") return Math.min(1, item.value / 2500);
  if (item.unit === "kg" && weight) return Math.min(1, item.value / weight);
  return 0.64;
}

export default function HealthDevicesScreen() {
  const c = useTheme();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [state, setState] = useState<ConnectionState>("idle");
  const [bluetoothState, setBluetoothState] = useState("unknown");
  const [devices, setDevices] = useState<ScaleDevice[]>([]);
  const [connected, setConnected] = useState<ScaleDevice | null>(null);
  const connectedRef = useRef<ScaleDevice | null>(null);
  const manualDisconnectRef = useRef(false);
  const lastWeightRef = useRef<number | null>(null);
  const stableFramesRef = useRef(0);
  const foundCountRef = useRef(0);
  const lastDiscoveryRef = useRef(new Map<string, ScaleDevice>());
  const scanLockRef = useRef(false);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scanSeconds, setScanSeconds] = useState(12);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<HealthSourceMeasurement[]>(
    [],
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [readingStable, setReadingStable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sessionIdRef = useRef("");
  const savedSessionRef = useRef("");
  const attemptedSessionRef = useRef("");
  const measurementsRef = useRef<HealthSourceMeasurement[]>([]);
  const profileRef = useRef<BodyCompositionProfile | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  useEffect(() => {
    measurementsRef.current = measurements;
  }, [measurements]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      void Promise.all([getProfileDetails(userId), listHealthEntries()]).then(
        ([profile, entries]) => {
          const heightCm =
            profile.heightCm ??
            entries.find((entry) => entry.type === "height")?.value ??
            null;
          if (
            (profile.biologicalSex === "male" ||
              profile.biologicalSex === "female") &&
            heightCm &&
            profile.birthday
          ) {
            profileRef.current = {
              biologicalSex: profile.biologicalSex,
              birthday: profile.birthday,
              heightCm,
            };
            setProfileComplete(true);
          } else {
            profileRef.current = null;
            setProfileComplete(false);
          }
        },
      );
    }, [userId]),
  );

  useEffect(() => {
    if (state !== "scanning") return;
    const timer = setInterval(
      () => setScanSeconds((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => {
    const discovered = BleManager.onDiscoverPeripheral((peripheral) => {
      const item = scaleDevice(peripheral);
      const previous = lastDiscoveryRef.current.get(item.id);
      if (!previous) foundCountRef.current += 1;
      lastDiscoveryRef.current.set(item.id, item);
      if (!previous || previous.name !== item.name) {
        console.info("[KASA BLE] Discovered", item.name, item.id, item.rssi);
      }
      setDevices((current) => {
        if (
          previous &&
          previous.name === item.name &&
          Math.abs(previous.rssi - item.rssi) < 8
        )
          return current;
        const next = current.filter((device) => device.id !== item.id);
        return [...next, item].sort(
          (a, b) =>
            Number(b.likelyScale) - Number(a.likelyScale) || b.rssi - a.rssi,
        );
      });
    });
    const scanStopped = BleManager.onStopScan(() => {
      console.info("[KASA BLE] Scan stopped", foundCountRef.current);
      setState((current) => (current === "scanning" ? "idle" : current));
      scanLockRef.current = false;
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      if (foundCountRef.current === 0) {
        setMessage(
          "No device appeared. Step on the scale once to wake it, close any other scale app, then scan again.",
        );
      }
    });
    const stateChanged = BleManager.onDidUpdateState(({ state: next }) =>
      setBluetoothState(next),
    );
    const disconnected = BleManager.onDisconnectPeripheral(({ peripheral }) => {
      if (connectedRef.current?.id !== peripheral) return;
      if (manualDisconnectRef.current) {
        manualDisconnectRef.current = false;
        connectedRef.current = null;
        setConnected(null);
        setState("idle");
        return;
      }
      setState("sleeping");
      setMessage(
        "Scale went to sleep. The last reading is safe—wake it and reconnect for another measurement.",
      );
    });
    const updated = BleManager.onDidUpdateValueForCharacteristic(
      (event: BleManagerDidUpdateValueForCharacteristicEvent) => {
        const device = connectedRef.current;
        if (!device || event.peripheral !== device.id) return;
        const packet: ScalePacket = {
          service: event.service,
          characteristic: event.characteristic,
          bytes: event.value,
          hex: packetHex(event.value),
        };
        if (
          packet.bytes[0] !== 0xac ||
          packet.bytes[1] !== 0x27 ||
          packet.bytes.slice(6, 18).some((byte) => byte !== 0)
        ) {
          console.info(
            "[KASA BLE] Composition packet",
            shortUuid(packet.service),
            shortUuid(packet.characteristic),
            packet.hex,
          );
        }
        const parsed = normalizeScaleMetrics(
          parseSmartScalePacket(packet),
          device,
          packet,
        );
        if (!parsed.length) {
          setMessage(
            "Scale data received. This model uses a custom packet; the diagnostic below will let us map it exactly.",
          );
          return;
        }
        const weight = parsed.find((item) => item.type === "weight")?.value;
        if (weight) {
          stableFramesRef.current =
            lastWeightRef.current === weight ? stableFramesRef.current + 1 : 1;
          lastWeightRef.current = weight;
          setReadingStable(stableFramesRef.current >= 4);
          if (stableFramesRef.current === 4) {
            console.info("[KASA BLE] Stable weight", weight, "kg");
          }
        }
        setMessage(null);
        setMeasurements((current) => {
          const next = new Map(current.map((item) => [item.type, item]));
          parsed.forEach((item) => next.set(item.type, item));
          const weightMeasurement = next.get("weight");
          const impedanceMeasurement = next.get("impedance");
          const profile = profileRef.current;
          if (weightMeasurement && profile) {
            const composition = deriveBodyComposition(
              weightMeasurement.value,
              profile,
              impedanceMeasurement?.value,
            );
            composition?.metrics.forEach((metric) => {
              const existing = next.get(metric.type);
              if (existing && existing.metadata?.derived !== true) return;
              next.set(metric.type, {
                ...metric,
                source: "smart-scale",
                recordedAt: weightMeasurement.recordedAt,
                metadata: {
                  ...weightMeasurement.metadata,
                  derived: true,
                  algorithm: "standard-bia",
                  impedanceUsed: composition.impedanceUsed,
                  impedanceFallback: composition.usedFallback,
                },
              });
            });
          }
          return [...next.values()];
        });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    );
    void startScaleBluetooth()
      .then(async () => setBluetoothState(await BleManager.checkState()))
      .catch((cause: unknown) =>
        setMessage(
          cause instanceof Error ? cause.message : "Bluetooth could not start.",
        ),
      );
    return () => {
      discovered.remove();
      scanStopped.remove();
      stateChanged.remove();
      disconnected.remove();
      updated.remove();
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, []);

  const likelyDevices = useMemo(
    () => devices.filter((device) => device.likelyScale),
    [devices],
  );
  const otherDevices = useMemo(
    () => devices.filter((device) => !device.likelyScale),
    [devices],
  );
  const measurementSignature = useMemo(
    () =>
      measurements
        .map((item) => `${item.type}:${item.value}:${item.unit}`)
        .sort()
        .join("|"),
    [measurements],
  );

  async function scan() {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setMessage(null);
    setSaved(false);
    setSavedAt(null);
    setSaveError(null);
    setDevices([]);
    foundCountRef.current = 0;
    lastDiscoveryRef.current.clear();
    setScanSeconds(12);
    setState("scanning");
    console.info("[KASA BLE] Starting scan");
    try {
      await startScaleBluetooth();
      const current = await BleManager.checkState();
      setBluetoothState(current);
      if (current !== "on")
        throw new Error("Turn Bluetooth on, then scan again.");
      await BleManager.scan({ seconds: 12, allowDuplicates: true });
      scanTimerRef.current = setTimeout(() => {
        void BleManager.stopScan().catch(() => undefined);
        void BleManager.getDiscoveredPeripherals().then((peripherals) => {
          const found = peripherals.map(scaleDevice);
          if (!found.length) return;
          foundCountRef.current = Math.max(foundCountRef.current, found.length);
          setMessage(null);
          setDevices(
            found.sort(
              (a, b) =>
                Number(b.likelyScale) - Number(a.likelyScale) ||
                b.rssi - a.rssi,
            ),
          );
        });
        scanLockRef.current = false;
        setState((currentState) =>
          currentState === "scanning" ? "idle" : currentState,
        );
      }, 12_500);
    } catch (cause) {
      console.error("[KASA BLE] Scan failed", cause);
      scanLockRef.current = false;
      setState("idle");
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Could not scan nearby devices.",
      );
    }
  }

  async function connect(device: ScaleDevice) {
    setState("connecting");
    setConnectingId(device.id);
    setMessage(null);
    setMeasurements([]);
    setSaved(false);
    setReadingStable(false);
    lastWeightRef.current = null;
    stableFramesRef.current = 0;
    sessionIdRef.current = `scale-${Date.now()}-${device.id.slice(-6)}`;
    savedSessionRef.current = "";
    attemptedSessionRef.current = "";
    console.info("[KASA BLE] Connecting", device.name, device.id);
    try {
      await BleManager.stopScan().catch(() => undefined);
      await Promise.race([
        BleManager.connect(device.id),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error("Scale connection timed out. Wake it and try again."),
              ),
            15000,
          ),
        ),
      ]);
      const info = await BleManager.retrieveServices(device.id);
      console.info(
        "[KASA BLE] Services",
        (info.services ?? []).map(({ uuid }) => shortUuid(uuid)).join(", "),
      );
      const subscribable = (info.characteristics ?? []).filter(
        ({ properties }) => properties.Notify || properties.Indicate,
      );
      let active = 0;
      for (const characteristic of subscribable) {
        try {
          await BleManager.startNotification(
            device.id,
            characteristic.service,
            characteristic.characteristic,
          );
          active += 1;
        } catch {
          // One unsupported characteristic must not prevent the scale session.
        }
      }
      connectedRef.current = device;
      setConnected(device);
      setState("connected");
      setConnectingId(null);
      setMessage(
        active
          ? null
          : "Connected, but no live measurement channel was advertised. Wake the scale once more.",
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      void BleManager.disconnect(device.id).catch(() => undefined);
      setState("idle");
      setConnectingId(null);
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Could not connect to this scale.",
      );
    }
  }

  async function disconnect() {
    if (!connected) return;
    manualDisconnectRef.current = true;
    await BleManager.disconnect(connected.id).catch(() => undefined);
    connectedRef.current = null;
    setConnected(null);
    setState("idle");
  }

  async function saveMeasurement(
    items: HealthSourceMeasurement[],
    device: ScaleDevice,
  ) {
    if (!items.length || savedSessionRef.current === sessionIdRef.current)
      return;
    const sessionId = sessionIdRef.current;
    const capturedAt = new Date().toISOString();
    attemptedSessionRef.current = sessionId;
    setSaving(true);
    setSaveError(null);
    setMessage(null);
    try {
      const validItems = items.filter(
        (entry) => Number.isFinite(entry.value) && entry.value > 0,
      );
      await createHealthEntries(
        validItems.map((entry) => ({
          ...entry,
          recordedAt: capturedAt,
          metadata: {
            ...entry.metadata,
            measurementSessionId: sessionId,
            capturedAt,
            deviceId: device.id,
            deviceName: device.name,
            protocol: device.protocol,
          },
        })),
        sessionId,
      );
      savedSessionRef.current = sessionId;
      setSaved(true);
      setSavedAt(capturedAt);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      setSaveError(
        cause instanceof Error
          ? cause.message
          : "Could not save scale measurements.",
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (
      !readingStable ||
      !connected ||
      !measurements.length ||
      saving ||
      attemptedSessionRef.current === sessionIdRef.current ||
      savedSessionRef.current === sessionIdRef.current
    )
      return;
    const timer = setTimeout(() => {
      void saveMeasurement(measurementsRef.current, connected);
    }, 900);
    return () => clearTimeout(timer);
  }, [
    connected,
    measurementSignature,
    measurements.length,
    readingStable,
    saving,
  ]);

  const weightMeasurement = measurements.find((item) => item.type === "weight");
  const weight = weightMeasurement?.value ?? 0;
  const highlights = highlightTypes
    .map((type) => measurements.find((item) => item.type === type))
    .filter((item): item is HealthSourceMeasurement => Boolean(item));
  const details = measurements.filter(
    (item) => item.type !== "weight" && !highlightTypes.includes(item.type),
  );

  function retrySave() {
    if (!connected) return;
    attemptedSessionRef.current = "";
    void saveMeasurement(measurementsRef.current, connected);
  }

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Pressable
            accessibilityLabel="Back to Health Hub"
            onPress={() => router.back()}
            style={[
              s.headerButton,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <SymbolView name="chevron.left" size={16} tintColor={c.text} />
          </Pressable>
          <Text style={[s.headerTitle, { color: c.text }]}>Health Sources</Text>
          <View style={s.headerButton} />
        </View>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.heroShadow}>
            <LinearGradient
              colors={[c.brand, c.brandStrong]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.hero}
            >
              <SymbolView name="scalemass.fill" size={30} tintColor="#FFFFFF" />
              <View style={s.heroCopy}>
                <Text style={s.heroEyebrow}>SMART SCALE</Text>
                <Text style={s.heroTitle}>
                  {connected ? "Ready to measure" : "Connect your scale"}
                </Text>
                <Text style={s.heroText}>
                  {connected
                    ? "Step on barefoot and stand still until the numbers settle."
                    : "Live measurements flow into Health Hub automatically in one clean format."}
                </Text>
              </View>
            </LinearGradient>
          </View>

          <View
            style={[
              s.statusCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <View style={[s.statusIcon, { backgroundColor: c.brandSoft }]}>
              <SymbolView
                name={
                  connected ? "checkmark" : "antenna.radiowaves.left.and.right"
                }
                size={17}
                tintColor={c.brand}
              />
            </View>
            <View style={s.statusCopy}>
              <Text style={[s.statusTitle, { color: c.text }]}>
                {state === "sleeping"
                  ? "Scale sleeping"
                  : connected
                    ? "Scale connected"
                    : `Bluetooth ${bluetoothState}`}
              </Text>
              <Text style={[s.statusText, { color: c.textSecondary }]}>
                {connected
                  ? state === "sleeping"
                    ? `${connected.name} · last reading retained`
                    : `${connected.name} · receiving live data`
                  : "Pair here—not from iPhone Bluetooth Settings."}
              </Text>
            </View>
            {connected ? (
              <Pressable
                onPress={() =>
                  state === "sleeping"
                    ? void connect(connected)
                    : void disconnect()
                }
              >
                <Text style={[s.textAction, { color: c.brand }]}>
                  {state === "sleeping" ? "Reconnect" : "Disconnect"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {connected ? (
            <>
              <Text style={[s.sectionTitle, { color: c.text }]}>
                Live measurement
              </Text>
              {measurements.length ? (
                <View
                  style={[
                    s.measureCard,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <LinearGradient
                    colors={[c.brand, c.brandStrong]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.weightHero}
                  >
                    <View style={s.liveHeading}>
                      <View style={s.livePill}>
                        <View style={s.liveDot} />
                        <Text style={s.liveLabel}>LIVE SCALE</Text>
                      </View>
                      <Text style={s.heroLiveState}>
                        {readingStable ? "STABLE" : "MEASURING"}
                      </Text>
                    </View>
                    <View style={s.weightContent}>
                      <View style={s.scalePulse}>
                        <SymbolView
                          name="scalemass.fill"
                          size={23}
                          tintColor="#FFFFFF"
                        />
                      </View>
                      <View style={s.weightCopy}>
                        <Text style={s.weightLabel}>CURRENT WEIGHT</Text>
                        <Text style={s.weightValue}>
                          {weight ? weight.toFixed(1) : "—"}
                          <Text style={s.weightUnit}> kg</Text>
                        </Text>
                      </View>
                      <Text style={s.signalCount}>
                        {measurements.length}
                        {"\n"}
                        <Text style={s.signalCountLabel}>SIGNALS</Text>
                      </Text>
                    </View>
                  </LinearGradient>

                  {highlights.length ? (
                    <>
                      <Text style={[s.gridEyebrow, { color: c.textSecondary }]}>
                        BODY SNAPSHOT
                      </Text>
                      <View style={s.metricGrid}>
                        {highlights.map((item) => (
                          <View
                            key={item.type}
                            style={[
                              s.metricTile,
                              { backgroundColor: c.backgroundElement },
                            ]}
                          >
                            <View style={s.metricTop}>
                              <SymbolView
                                name={metricIcons[item.type] ?? "sparkles"}
                                size={14}
                                tintColor={c.brand}
                              />
                              {item.metadata?.derived === true ? (
                                <Text style={[s.estimated, { color: c.brand }]}>
                                  EST.
                                </Text>
                              ) : null}
                            </View>
                            <Text
                              style={[
                                s.metricLabel,
                                { color: c.textSecondary },
                              ]}
                            >
                              {labels[item.type]}
                            </Text>
                            <Text style={[s.metricValue, { color: c.text }]}>
                              {item.value}
                              <Text style={s.metricUnit}> {item.unit}</Text>
                            </Text>
                            <View
                              style={[
                                s.metricTrack,
                                { backgroundColor: c.border },
                              ]}
                            >
                              <View
                                style={[
                                  s.metricFill,
                                  {
                                    backgroundColor: c.brand,
                                    width: `${Math.max(8, metricProgress(item, weight) * 100)}%`,
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}

                  {details.length ? (
                    <>
                      <Text style={[s.gridEyebrow, { color: c.textSecondary }]}>
                        BODY DETAILS
                      </Text>
                      <View style={s.detailGrid}>
                        {details.map((item) => (
                          <View
                            key={item.type}
                            style={[s.detailTile, { borderColor: c.border }]}
                          >
                            <View
                              style={[
                                s.detailIcon,
                                { backgroundColor: c.brandSoft },
                              ]}
                            >
                              <SymbolView
                                name={
                                  metricIcons[item.type] ?? "waveform.path.ecg"
                                }
                                size={12}
                                tintColor={c.brand}
                              />
                            </View>
                            <View style={s.detailCopy}>
                              <Text
                                numberOfLines={1}
                                style={[
                                  s.detailLabel,
                                  { color: c.textSecondary },
                                ]}
                              >
                                {labels[item.type]}
                                {item.metadata?.derived === true
                                  ? " · EST."
                                  : ""}
                              </Text>
                              <Text style={[s.detailValue, { color: c.text }]}>
                                {item.value}{" "}
                                <Text style={s.detailUnit}>{item.unit}</Text>
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}
                  <View
                    style={[s.autoSaveBar, { backgroundColor: c.brandSoft }]}
                  >
                    {saving ? (
                      <KasaSpinner size={16} />
                    ) : (
                      <SymbolView
                        name={
                          saved
                            ? "checkmark.circle.fill"
                            : saveError
                              ? "exclamationmark.circle.fill"
                              : "clock.fill"
                        }
                        size={16}
                        tintColor={c.brand}
                      />
                    )}
                    <Text style={[s.autoSaveText, { color: c.text }]}>
                      {saved
                        ? `Saved from Smart Scale${savedAt ? ` · ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`
                        : saveError
                          ? "Save failed — your reading is still here"
                          : readingStable
                            ? saving
                              ? "Saving all measurements…"
                              : "Reading ready"
                            : "Auto-saves when the reading settles"}
                    </Text>
                    {saveError ? (
                      <Pressable onPress={retrySave} style={s.retryButton}>
                        <Text style={[s.retryText, { color: c.brand }]}>
                          RETRY
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {!profileComplete ? (
                    <Pressable
                      onPress={() => router.push("/edit-profile")}
                      style={[s.profileNotice, { borderColor: c.border }]}
                    >
                      <View style={s.profileNoticeCopy}>
                        <Text style={[s.profileNoticeTitle, { color: c.text }]}>
                          Complete body analysis
                        </Text>
                        <Text
                          style={[
                            s.profileNoticeText,
                            { color: c.textSecondary },
                          ]}
                        >
                          Add height, birthday and biological sex once in your
                          profile.
                        </Text>
                      </View>
                      <Text style={[s.textAction, { color: c.brand }]}>
                        ADD
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <View
                  style={[
                    s.waitingCard,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <KasaSpinner size={25} />
                  <View style={s.waitingCopy}>
                    <Text style={[s.waitingTitle, { color: c.text }]}>
                      Waiting for the scale
                    </Text>
                    <Text style={[s.waitingText, { color: c.textSecondary }]}>
                      Wake it by stepping on barefoot. Keep the app open and
                      stand still.
                    </Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              {state === "scanning" ? (
                <View
                  style={[
                    s.scanCard,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <View
                    style={[s.scanSpinner, { backgroundColor: c.brandSoft }]}
                  >
                    <KasaSpinner size={30} />
                  </View>
                  <Text style={[s.scanTitle, { color: c.text }]}>
                    Finding your scale…
                  </Text>
                  <Text style={[s.scanText, { color: c.textSecondary }]}>
                    Step on the scale once now to wake it. Keep any other scale
                    app completely closed.
                  </Text>
                  <Text style={[s.scanCountdown, { color: c.brand }]}>
                    {scanSeconds}s
                  </Text>
                </View>
              ) : (
                <Pressable
                  disabled={state === "connecting"}
                  onPress={() => void scan()}
                  style={({ pressed }) => [
                    s.primaryButton,
                    { backgroundColor: c.brand, opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Text style={s.primaryText}>Find smart scale</Text>
                </Pressable>
              )}
              {(likelyDevices.length > 0 || otherDevices.length > 0) && (
                <View style={s.deviceSection}>
                  <Text style={[s.sectionTitle, { color: c.text }]}>
                    Nearby
                  </Text>
                  {[...likelyDevices, ...otherDevices].map((device) => (
                    <Pressable
                      key={device.id}
                      disabled={state === "connecting"}
                      onPress={() => void connect(device)}
                      style={({ pressed }) => [
                        s.deviceRow,
                        {
                          backgroundColor: c.surface,
                          borderColor: c.border,
                          opacity: pressed ? 0.72 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[s.deviceIcon, { backgroundColor: c.brandSoft }]}
                      >
                        <SymbolView
                          name="scalemass"
                          size={18}
                          tintColor={c.brand}
                        />
                      </View>
                      <View style={s.deviceCopy}>
                        <Text style={[s.deviceName, { color: c.text }]}>
                          {device.name}
                        </Text>
                        <Text
                          style={[s.deviceMeta, { color: c.textSecondary }]}
                        >
                          {device.likelyScale
                            ? "Likely health scale"
                            : `Device …${device.id.slice(-6)}`}{" "}
                          · signal {device.rssi} dBm
                        </Text>
                      </View>
                      {connectingId === device.id ? (
                        <KasaSpinner size={17} />
                      ) : (
                        <Text style={[s.connectText, { color: c.brand }]}>
                          Connect
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}

          {message ? (
            <View style={[s.message, { backgroundColor: c.brandSoft }]}>
              <Text style={[s.messageText, { color: c.text }]}>{message}</Text>
            </View>
          ) : null}

          <Text style={[s.privacy, { color: c.textSecondary }]}>
            Data stays in the normalized KASA Health Hub format. KASA does not
            make medical diagnoses.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" },
  safe: { flex: 1 },
  header: {
    height: 54,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 14, fontWeight: "900", letterSpacing: -0.2 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 42 },
  heroShadow: {
    borderRadius: 28,
    boxShadow: "0 16px 36px rgba(223,60,13,0.22)",
  },
  hero: {
    minHeight: 190,
    borderRadius: 28,
    padding: 22,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  heroCopy: { marginTop: 24 },
  heroEyebrow: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.25,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 27,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: -1.15,
    marginTop: 7,
  },
  heroText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 7,
    maxWidth: "92%",
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  statusCopy: { flex: 1, marginLeft: 11 },
  statusTitle: { fontSize: 12, fontWeight: "800" },
  statusText: { fontSize: 9, lineHeight: 14, marginTop: 2 },
  textAction: { fontSize: 9, fontWeight: "900" },
  primaryButton: {
    minHeight: 51,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  primaryText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  scanCard: {
    minHeight: 190,
    borderWidth: 1,
    borderRadius: 24,
    marginTop: 14,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  scanSpinner: {
    width: 58,
    height: 58,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  scanTitle: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.35,
    marginTop: 13,
  },
  scanText: {
    fontSize: 9.5,
    lineHeight: 15,
    textAlign: "center",
    maxWidth: 270,
    marginTop: 5,
  },
  scanCountdown: { fontSize: 10, fontWeight: "900", marginTop: 10 },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 24,
    marginBottom: 10,
  },
  deviceSection: { marginTop: 2 },
  deviceRow: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 21,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  deviceCopy: { flex: 1, marginHorizontal: 11 },
  deviceName: { fontSize: 12, fontWeight: "800" },
  deviceMeta: { fontSize: 8, marginTop: 3 },
  connectText: { fontSize: 9, fontWeight: "900" },
  waitingCard: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 23,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  waitingCopy: { flex: 1, marginLeft: 13 },
  waitingTitle: { fontSize: 13, fontWeight: "800" },
  waitingText: { fontSize: 9, lineHeight: 14, marginTop: 4 },
  measureCard: { borderWidth: 1, borderRadius: 24, padding: 10 },
  weightHero: { borderRadius: 20, padding: 16, overflow: "hidden" },
  liveHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" },
  liveLabel: {
    color: "#FFFFFF",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1,
  },
  heroLiveState: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  weightContent: { flexDirection: "row", alignItems: "center" },
  scalePulse: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  weightCopy: { flex: 1, marginLeft: 13 },
  weightLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  weightValue: {
    color: "#FFFFFF",
    fontSize: 35,
    lineHeight: 39,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  weightUnit: { fontSize: 13, fontWeight: "800", letterSpacing: -0.2 },
  signalCount: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 16,
    lineHeight: 15,
    fontWeight: "900",
  },
  signalCountLabel: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 6,
    letterSpacing: 0.7,
  },
  gridEyebrow: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.05,
    marginTop: 15,
    marginBottom: 8,
    marginHorizontal: 3,
  },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metricTile: { width: "48.7%", minHeight: 112, borderRadius: 18, padding: 12 },
  metricTop: {
    minHeight: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  estimated: { fontSize: 6, fontWeight: "900", letterSpacing: 0.7 },
  metricLabel: { fontSize: 8, fontWeight: "700", marginTop: 7 },
  metricValue: { fontSize: 19, fontWeight: "900", marginTop: 2 },
  metricUnit: { fontSize: 8, fontWeight: "700" },
  metricTrack: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 9 },
  metricFill: { height: 4, borderRadius: 2 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  detailTile: {
    width: "48.8%",
    minHeight: 61,
    borderWidth: 1,
    borderRadius: 17,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  detailCopy: { flex: 1, marginLeft: 8 },
  detailLabel: { fontSize: 7, fontWeight: "700" },
  detailValue: { fontSize: 12, fontWeight: "900", marginTop: 2 },
  detailUnit: { fontSize: 7, fontWeight: "700" },
  autoSaveBar: {
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 13,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  autoSaveText: { flex: 1, fontSize: 9, fontWeight: "800", marginLeft: 7 },
  retryButton: { paddingVertical: 8, paddingLeft: 10 },
  retryText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  profileNotice: {
    minHeight: 58,
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  profileNoticeCopy: { flex: 1, paddingRight: 12 },
  profileNoticeTitle: { fontSize: 10, fontWeight: "800" },
  profileNoticeText: { fontSize: 8, lineHeight: 12, marginTop: 2 },
  message: { borderRadius: 17, padding: 13, marginTop: 13 },
  messageText: { fontSize: 9.5, lineHeight: 15, fontWeight: "600" },
  privacy: {
    fontSize: 8,
    lineHeight: 13,
    textAlign: "center",
    marginTop: 22,
    paddingHorizontal: 18,
  },
});
