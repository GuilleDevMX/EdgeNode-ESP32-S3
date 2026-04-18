interface DhtConfig {
  pin: number;
  type: number;
  t_off: number;
}

interface SensorConfig {
  sensors: DhtConfig[];
  adc_pin: number;
  adc_gnd_pin?: number;
  r1: number;
  r2: number;
  adc_offset: number;
  adc_mult: number;
  sleep_mode: number;
  sleep_time: number;
  polling_rate: number;
}

export type { SensorConfig, DhtConfig };