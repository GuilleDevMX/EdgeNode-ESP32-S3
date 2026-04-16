interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  pass: string;
  dest: string;
  t_max: number;
  t_min: number;
  h_max: number;
  h_min: number;
  b_min: number;
  cooldown: number;
  alert_temp: boolean;
  alert_hum: boolean;
  alert_sec: boolean;
}

export type { SmtpConfig };