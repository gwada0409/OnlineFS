import { useCallback, useEffect, useMemo, useRef } from 'react';

export const useLatestRequest = () => {
  const version = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; version.current++; };
  }, []);
  const begin = useCallback(() => ++version.current, []);
  const isCurrent = useCallback((request: number) => mounted.current && request === version.current, []);
  const invalidate = useCallback(() => { version.current++; }, []);
  return useMemo(() => ({ begin, isCurrent, invalidate }), [begin, invalidate, isCurrent]);
};
