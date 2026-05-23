import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';

export function useApiData<T>(url: string, defaultValue: T) {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { token } = useAuthStore();

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      const json = await res.json();
      // Usually APIs wrap data in { data: ... }
      setData(json.data !== undefined ? json.data : json);
      setError(null);
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [url, token]);

  return { data, loading, error, refetch: fetchData };
}
