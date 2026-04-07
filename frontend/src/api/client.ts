export const API_BASE_URL = import.meta.env.DEV ? 'http://192.168.1.171' : '';

export async function fetcher<T>(url: string, token?: string | null): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const swrFetcher = async (args: readonly [string, string | null]) => {
  const [url, token] = args;
  return fetcher<any>(url, token);
};
