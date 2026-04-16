interface NetworkConfig {
  ssid: string;
  pass: string;
  dhcp: boolean;
  ip: string;
  subnet: string;
  gateway: string;
  dns: string;
  ap_ssid: string;
  ap_pass: string;
  ap_hide: boolean;
  mdns: string;
  ntp: string;
  tz: string;
}

export type { NetworkConfig };