const RECORD_TYPE = 'local_storage';

const getToken = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('tms_token');
};

export const readLocalValue = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const user = JSON.parse(window.localStorage.getItem('tms_user') || 'null') as { role?: string } | null;
    const isRegAdmin = user?.role === 'REGION_ADMIN';
    if (isRegAdmin) return fallback;
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : fallback;
  } catch {
    return fallback;
  }
};

export const fetchSyncedValue = async <T>(key: string, fallback: T): Promise<T> => {
  const token = getToken();
  if (!token) return readLocalValue(key, fallback);

  try {
    const response = await fetch(`/api/synced-records?recordType=${RECORD_TYPE}&recordKey=${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Sync read failed');
    const data = await response.json();
    if (data.payload === null || typeof data.payload === 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    window.localStorage.setItem(key, JSON.stringify(data.payload));
    return data.payload as T;
  } catch {
    return readLocalValue(key, fallback);
  }
};

export const saveSyncedValue = async <T>(key: string, value: T) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  const token = getToken();
  if (!token) return;

  try {
    await fetch('/api/synced-records', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        recordType: RECORD_TYPE,
        recordKey: key,
        payload: value,
      }),
    });
  } catch {
    // Keep local copy if the network/database is temporarily unavailable.
  }
};
