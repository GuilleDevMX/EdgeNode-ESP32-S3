interface CloudConfig {
  enabled: boolean;
  url: string;
  token: string;
  mtls_cert?: string;
  mtls_key?: string;
  mtls_ca?: string;
}

export type { CloudConfig };