// Universal data-fetching hook — used by every page/module
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useApi(fetcher, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const { token } = useAuth();
  const abortRef = useRef(null);

  const load = useCallback(async () => {
    if (!token || !fetcher) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      setData(res?.data ?? res);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, ...deps]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}
