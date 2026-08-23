import { PermissionsAndroid, Platform } from "react-native";
import BleManager from "react-native-ble-manager";

import type { HealthSourceMeasurement } from "@/lib/health-sources/types";

export const WEIGHT_SERVICE = "181d";
export const WEIGHT_MEASUREMENT = "2a9d";
export const BODY_COMPOSITION_SERVICE = "181b";
export const BODY_COMPOSITION_MEASUREMENT = "2a9c";

export type ScaleDevice = {
  id: string;
  name: string;
  rssi: number;
  likelyScale: boolean;
  protocol: "bluetooth-standard" | "ffb0-compatible" | "unknown";
};

export type ScalePacket = {
  service: string;
  characteristic: string;
  bytes: number[];
  hex: string;
};

type Metric = Pick<HealthSourceMeasurement, "type" | "value" | "unit">;

const cleanUuid = (uuid: string) => uuid.toLowerCase().replaceAll("-", "");

export function shortUuid(uuid: string) {
  const clean = cleanUuid(uuid);
  return clean.length === 32 && clean.startsWith("0000")
    ? clean.slice(4, 8)
    : clean;
}

export function packetHex(bytes: number[]) {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function uint16(bytes: number[], offset: number) {
  if (offset + 1 >= bytes.length) return null;
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function massKg(raw: number, imperial: boolean) {
  return imperial ? raw * 0.01 * 0.45359237 : raw * 0.005;
}

function rounded(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function uint16BigEndian(bytes: number[], offset: number) {
  if (offset + 1 >= bytes.length) return null;
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function validMetric(
  type: Metric["type"],
  value: number,
  unit: string,
  min: number,
  max: number,
): Metric[] {
  return Number.isFinite(value) && value >= min && value <= max
    ? [{ type, value: rounded(value, 1), unit }]
    : [];
}

function parseFfb0Packet(packet: ScalePacket): Metric[] {
  const characteristic = shortUuid(packet.characteristic);
  const bytes = packet.bytes;
  if (characteristic !== "ffb2") return [];

  if (bytes.length >= 9 && bytes[1] === 0x07 && bytes[3] === 0xa2) {
    const grams = (bytes[6] << 16) | (bytes[7] << 8) | bytes[8];
    return validMetric("weight", grams / 1000, "kg", 2, 300);
  }

  if (bytes.length === 8 && bytes[0] === 0xac && bytes[1] === 0x02) {
    const checksum =
      bytes.slice(2, 7).reduce((sum, byte) => sum + byte, 0) & 0xff;
    if (checksum !== bytes[7]) return [];
    if (
      (bytes[6] === 0xca || bytes[6] === 0xce) &&
      bytes[4] === 0 &&
      bytes[5] === 0
    ) {
      return validMetric(
        "weight",
        ((bytes[2] << 8) | bytes[3]) / 100,
        "kg",
        2,
        300,
      );
    }
    if (bytes[6] === 0xcb && bytes[2] === 0xfd && bytes[3] === 0x01) {
      return validMetric(
        "impedance",
        (bytes[4] << 8) | bytes[5],
        "ohm",
        1,
        2000,
      );
    }
  }

  if (
    bytes.length === 20 &&
    bytes[0] === 0xac &&
    (bytes[1] === 0x02 || bytes[1] === 0x03) &&
    bytes[2] === 0xff
  ) {
    const weight = uint16BigEndian(bytes, 12);
    const bmi = uint16BigEndian(bytes, 14);
    const bodyFat = uint16BigEndian(bytes, 16);
    return [
      ...(weight === null
        ? []
        : validMetric("weight", weight / 10, "kg", 2, 300)),
      ...(bmi === null ? [] : validMetric("bmi", bmi / 10, "score", 5, 100)),
      ...(bodyFat === null
        ? []
        : validMetric("bodyFat", bodyFat / 10, "%", 1, 80)),
    ];
  }

  if (bytes.length === 20 && bytes[0] === 0x01 && bytes[1] === 0x00) {
    const muscle = uint16(bytes, 2);
    const bmr = uint16(bytes, 4);
    const bone = uint16(bytes, 6);
    const water = uint16(bytes, 8);
    const bodyAge = bytes[10];
    return [
      ...(muscle === null
        ? []
        : validMetric("musclePercentage", muscle / 10, "%", 1, 100)),
      ...(bmr === null
        ? []
        : validMetric("basalMetabolism", bmr / 10, "kcal/day", 300, 5000)),
      ...(bone === null
        ? []
        : validMetric("boneMass", bone / 10, "kg", 0.1, 20)),
      ...(water === null
        ? []
        : validMetric("bodyWaterMass", water / 10, "%", 1, 100)),
      ...validMetric("bodyAge", bodyAge, "years", 1, 120),
    ];
  }

  if (bytes.length === 20 && bytes[0] === 0xac && bytes[1] === 0x27) {
    let grams = 0;
    if (bytes[2] === 0x01 && bytes[3] === 0x00) {
      grams = ((bytes[8] & 0x01) << 16) | (bytes[9] << 8) | bytes[10];
    } else {
      grams = ((bytes[3] & 0x01) << 16) | (bytes[4] << 8) | bytes[5];
    }
    const weight = grams / 1000;
    return weight >= 2 && weight <= 300
      ? [{ type: "weight", value: rounded(weight, 3), unit: "kg" }]
      : [];
  }
  return [];
}

function parseBluetoothStandardPacket(packet: ScalePacket): Metric[] {
  const characteristic = shortUuid(packet.characteristic);
  const bytes = packet.bytes;
  if (characteristic === WEIGHT_MEASUREMENT) {
    if (bytes.length < 3) return [];
    const flags = bytes[0];
    const imperial = Boolean(flags & 0x01);
    const rawWeight = uint16(bytes, 1);
    if (rawWeight === null) return [];
    const metrics: Metric[] = [
      {
        type: "weight",
        value: rounded(massKg(rawWeight, imperial)),
        unit: "kg",
      },
    ];
    let offset = 3;
    if (flags & 0x02) offset += 7;
    if (flags & 0x04) offset += 1;
    if (flags & 0x08) {
      const bmi = uint16(bytes, offset);
      const height = uint16(bytes, offset + 2);
      if (bmi !== null)
        metrics.push({
          type: "bmi",
          value: rounded(bmi * 0.1, 1),
          unit: "score",
        });
      if (height !== null) {
        const cm = imperial ? height * 0.1 * 2.54 : height * 0.1;
        metrics.push({ type: "height", value: rounded(cm, 1), unit: "cm" });
      }
    }
    return metrics;
  }

  if (characteristic !== BODY_COMPOSITION_MEASUREMENT || bytes.length < 4)
    return [];
  const flags = uint16(bytes, 0);
  if (flags === null) return [];
  const imperial = Boolean(flags & 0x01);
  let offset = 2;
  const metrics: Metric[] = [];
  const take = () => {
    const value = uint16(bytes, offset);
    offset += 2;
    return value;
  };
  const bodyFat = take();
  if (bodyFat !== null)
    metrics.push({
      type: "bodyFat",
      value: rounded(bodyFat * 0.1, 1),
      unit: "%",
    });
  if (flags & 0x02) offset += 7;
  if (flags & 0x04) offset += 1;
  if (flags & 0x08) {
    const raw = take();
    if (raw !== null)
      metrics.push({
        type: "basalMetabolism",
        value: rounded(raw / 4.184, 0),
        unit: "kcal/day",
      });
  }
  if (flags & 0x10) {
    const raw = take();
    if (raw !== null)
      metrics.push({
        type: "musclePercentage",
        value: rounded(raw * 0.1, 1),
        unit: "%",
      });
  }
  const takeMass = (type: Metric["type"]) => {
    const raw = take();
    if (raw !== null)
      metrics.push({ type, value: rounded(massKg(raw, imperial)), unit: "kg" });
  };
  if (flags & 0x20) takeMass("muscleMass");
  if (flags & 0x40) takeMass("fatFreeMass");
  if (flags & 0x80) takeMass("leanMass");
  if (flags & 0x100) takeMass("bodyWaterMass");
  if (flags & 0x200) {
    const raw = take();
    if (raw !== null)
      metrics.push({
        type: "impedance",
        value: rounded(raw * 0.1, 1),
        unit: "ohm",
      });
  }
  if (flags & 0x400) takeMass("weight");
  if (flags & 0x800) {
    const raw = take();
    if (raw !== null) {
      const cm = imperial ? raw * 0.1 * 2.54 : raw * 0.1;
      metrics.push({ type: "height", value: rounded(cm, 1), unit: "cm" });
    }
  }
  return metrics;
}

const packetAdapters = [parseFfb0Packet, parseBluetoothStandardPacket];

export function parseSmartScalePacket(packet: ScalePacket): Metric[] {
  for (const parse of packetAdapters) {
    const metrics = parse(packet);
    if (metrics.length) return metrics;
  }
  return [];
}

export function normalizeScaleMetrics(
  metrics: Metric[],
  device: ScaleDevice,
  packet: ScalePacket,
): HealthSourceMeasurement[] {
  const recordedAt = new Date().toISOString();
  return metrics.map((metric) => ({
    ...metric,
    source: "smart-scale",
    recordedAt,
    metadata: {
      deviceId: device.id,
      deviceName: device.name,
      serviceUuid: packet.service,
      characteristicUuid: packet.characteristic,
      rawHex: packet.hex,
    },
  }));
}

export function scaleDevice(peripheral: {
  id: string;
  name?: string;
  rssi?: number;
  advertising?: { localName?: string; serviceUUIDs?: string[] };
}): ScaleDevice {
  const advertisedName =
    peripheral.name || peripheral.advertising?.localName || "Unnamed device";
  const model = /^ssw\s*[-_]?\s*(\d+)$/i.exec(advertisedName)?.[1];
  const serviceUuids = peripheral.advertising?.serviceUUIDs ?? [];
  const hasStandardService = serviceUuids.some((uuid) =>
    [WEIGHT_SERVICE, BODY_COMPOSITION_SERVICE].includes(shortUuid(uuid)),
  );
  const hasFfb0Service = serviceUuids.some(
    (uuid) => shortUuid(uuid) === "ffb0",
  );
  return {
    id: peripheral.id,
    name: model ? `Smart Scale ${model}` : advertisedName,
    rssi: peripheral.rssi ?? -100,
    likelyScale:
      Boolean(model) ||
      /scale|body|weight|health/i.test(advertisedName) ||
      hasStandardService ||
      hasFfb0Service,
    protocol: hasStandardService
      ? "bluetooth-standard"
      : hasFfb0Service || Boolean(model)
        ? "ffb0-compatible"
        : "unknown",
  };
}

export async function requestBluetoothPermission() {
  if (Platform.OS !== "android") return true;
  if (Number(Platform.Version) >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(result).every(
      (value) => value === PermissionsAndroid.RESULTS.GRANTED,
    );
  }
  return (
    (await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    )) === PermissionsAndroid.RESULTS.GRANTED
  );
}

let bluetoothStartPromise: Promise<void> | null = null;

export async function startScaleBluetooth() {
  if (bluetoothStartPromise) return bluetoothStartPromise;
  bluetoothStartPromise = (async () => {
    if (!(await requestBluetoothPermission()))
      throw new Error("Bluetooth permission is required to find the scale.");
    if (!(await BleManager.isStarted())) {
      await BleManager.start({ showAlert: false });
    }
    await BleManager.checkState();
  })();
  try {
    await bluetoothStartPromise;
  } catch (cause) {
    bluetoothStartPromise = null;
    throw cause;
  }
}
