import type { HealthEntryInput } from "@/lib/health";

export type HealthSourceId = "manual" | "smart-scale";

export type HealthSourceMeasurement = HealthEntryInput & {
  source: Exclude<HealthSourceId, "manual">;
};

export type HealthSourceConnector<TDevice> = {
  readonly source: Exclude<HealthSourceId, "manual">;
  start(): Promise<void>;
  scan(): Promise<void>;
  connect(device: TDevice): Promise<void>;
  disconnect(): Promise<void>;
};
