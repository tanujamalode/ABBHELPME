import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Repository } from '@/data/repository';
import { useApp } from './AppProvider';

/** Loads data from the repository; refreshes when a screen regains focus and whenever local data changes. */
export function useData<T>(load: (repo: Repository) => Promise<T>, deps: unknown[] = []) {
  const { repo, version } = useApp();
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  const depKey = JSON.stringify(deps);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const next = await loadRef.current(repo);
        if (!alive) return;
        setData(next);
        setError(null);
      } catch {
        if (alive) setError('Something went wrong while loading. Please try again.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [repo, version, tick, depKey]);

  const seenFocus = useRef(false);
  useFocusEffect(useCallback(() => {
    if (seenFocus.current) setTick((t) => t + 1);
    else seenFocus.current = true;
  }, []));

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}
