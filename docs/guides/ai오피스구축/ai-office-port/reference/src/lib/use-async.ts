import { useEffect, useState } from "react";

/**
 * Tiny loader hook — kicks off an async fn on mount (and when deps change),
 * keeps the previous resolution visible while a refetch is in flight.
 *
 * `loading` is true ONLY when there's no data yet (initial load). Subsequent
 * refetches keep the old `data` visible and only flip `refreshing` true.
 * This avoids the "blank → scroll-to-top → restore" flash that happens
 * whenever a like/comment/vote triggers a refresh.
 *
 * If you need to distinguish the two states explicitly, read `refreshing`.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
): { data: T | null; loading: boolean; refreshing: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    fn().then((value) => {
      if (cancelled) return;
      setData(value);
      setRefreshing(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading: data === null && refreshing, refreshing };
}
