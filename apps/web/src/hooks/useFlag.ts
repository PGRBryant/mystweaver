import { useCallback, useEffect, useState } from 'react';
import type { Flag } from '@/types/flag';
import { fetchFlag } from '@/api/client';

export function useFlag(key: string) {
  const [flag, setFlag] = useState<Flag | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFlag(await fetchFlag(key));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flag');
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { flag, loading, error, refetch: load };
}
