import useSWR from 'swr';
import { swrFetcher } from '../api/client';

export interface StorageMetrics {
  fs_total: number;
  fs_used: number;
  nvs_total: number;
  nvs_used: number;
}

export function useStorage(token: string | null) {
  const { data, error, mutate } = useSWR<StorageMetrics>(
    token ? ['/api/system/storage', token] : null,
    swrFetcher,
    { refreshInterval: 30000 }
  );

  const defaultMetrics: StorageMetrics = { fs_total: 0, fs_used: 0, nvs_total: 0, nvs_used: 0 };

  return {
    metrics: data || defaultMetrics,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate
  };
}

export function useConfig<T>(endpoint: string, token: string | null, activeTab: string, tabName: string) {
  const shouldFetch = token && activeTab === tabName;
  const { data, error, mutate } = useSWR<T>(
    shouldFetch ? [endpoint, token] : null,
    swrFetcher,
    { revalidateOnFocus: false }
  );

  return {
    config: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate
  };
}
