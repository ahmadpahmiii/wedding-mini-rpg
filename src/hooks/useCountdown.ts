import { useEffect, useState } from 'react';

export interface Remaining { days: number; hours: number; mins: number; secs: number; past: boolean }

function compute(targetMs: number): Remaining {
  const diff = targetMs - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, past: true };
  const s = Math.floor(diff / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins: Math.floor((s % 3600) / 60),
    secs: s % 60,
    past: false,
  };
}

/** Recomputes from Date.now() each tick — a decrementing counter drifts once the tab is backgrounded. */
export function useCountdown(iso: string, running = true): Remaining {
  const target = new Date(iso).getTime();
  const [rem, setRem] = useState(() => compute(target));

  useEffect(() => {
    if (!running) return;
    setRem(compute(target));
    const id = window.setInterval(() => setRem(compute(target)), 1000);
    return () => window.clearInterval(id);
  }, [target, running]);

  return rem;
}
