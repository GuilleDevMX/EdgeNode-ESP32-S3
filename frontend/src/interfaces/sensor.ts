interface SensorConfig {
  dht_pin: number;
  dht_type: number;
  adc_pin: number;
  r1: number;
  r2: number;
  temp_offset: number;
  adc_offset: number;
  adc_mult: number;
  sleep_mode: number;
  sleep_time: number;
  polling_rate: number;
}

export type { SensorConfig };