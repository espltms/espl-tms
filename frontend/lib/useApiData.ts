import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';

const responseCache = new Map<string, { data: unknown; expiresAt: number }>();
const inflightRequests = new Map<string, Promise<unknown>>();

type UseApiDataOptions = {
  cacheMs?: number;
};

export function useApiData<T>(url: string, defaultValue: T, options: UseApiDataOptions = {}) {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { token } = useAuthStore();
  const cacheMs = options.cacheMs ?? 15_000;
  const cacheKey = `${token || 'public'}:${url}`;

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const cached = responseCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        setData(cached.data as T);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading((current) => current || !cached);
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const request =
        inflightRequests.get(cacheKey) ||
        fetch(url, { headers, signal }).then(async (res) => {
          if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
          }
          return res.json();
        });

      inflightRequests.set(cacheKey, request);
      const json = await request;
      // Usually APIs wrap data in { data: ... }
      const nextData = json.data !== undefined ? json.data : json;
      responseCache.set(cacheKey, { data: nextData, expiresAt: Date.now() + cacheMs });
      setData(nextData);
      setError(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error(`Failed to fetch ${url}:`, err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      inflightRequests.delete(cacheKey);
      setLoading(false);
    }
  }, [cacheKey, cacheMs, token, url]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
