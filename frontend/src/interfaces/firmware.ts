interface SystemInfo {
  chip_model: string;
  cores: number;
  sdk_version: string;
  fw_version: string;
  build_date: string;
  ml_status: string;
}

export type { SystemInfo };