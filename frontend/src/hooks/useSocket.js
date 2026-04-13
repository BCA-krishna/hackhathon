import { useMemo } from 'react';

// Socket-based backend events are deprecated. Firebase onSnapshot streams are used instead.
export function useSocket() {
  return useMemo(() => [], []);
}
