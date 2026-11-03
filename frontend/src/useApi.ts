import { useEffect, useState } from "react";

/** Loads data once per `key` (and again every `refreshMs`, if given). Keeps showing old data while refreshing. */
export function useApi<T>(load: () => Promise<T>, key: string, refreshMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    const run = () =>
      load()
        .then((d) => {
          if (!cancelled) {
            setData(d);
            setError(null);
          }
        })
        .catch((e) => !cancelled && setError((e as Error).message));
    run();
    const timer = refreshMs ? setInterval(run, refreshMs) : undefined;
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, error };
}
