interface SensorData {
  id: number;
  t: number;
  h: number;
}

interface Telemetry {
  heap_free: number;
  psram_free: number;
  heap_max_block?: number;
  psram_max_block?: number;
  ml_inference_us?: number;
  uptime: number;
  sensors?: SensorData[];
  battery_v?: number;
  power_state?: string;
}

export type { Telemetry, SensorData };