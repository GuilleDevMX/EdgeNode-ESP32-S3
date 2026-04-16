interface StorageMetrics {
  flash_total?: number;
  fs_total: number;
  fs_used: number;
  nvs_total: number;
  nvs_used: number;
}

export type { StorageMetrics };