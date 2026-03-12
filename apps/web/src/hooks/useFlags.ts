import { useCallback, useEffect, useState } from 'react';
import type { Flag } from '@/types/flag';
import { fetchFlags } from '@/api/client';

export function useFlags() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFlags(await fetchFlags());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { flags, loading, error, refetch: load };
}
