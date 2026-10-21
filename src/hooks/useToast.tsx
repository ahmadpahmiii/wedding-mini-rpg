import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

/** `win` is a milestone. */
type Tone = 'ok' | 'info' | 'bad' | 'win';
interface ToastState { id: number; text: string; tone: Tone }

const Ctx = createContext<(text: string, tone?: Tone) => void>(() => undefined);
export const useToast = () => useContext(Ctx);

const ICON: Record<Tone, string> = { ok: '✓', info: '💌', bad: '!', win: '★' };
const RING: Record<Tone, string> = {
  ok: 'border-gold-500', info: 'border-gold-500', bad: 'border-wax-500', win: 'border-gold-400',
};
const DISC: Record<Tone, string> = {
  ok: 'bg-emerald-500 text-parchment-100', info: 'bg-gold-500 text-wood-800', bad: 'bg-wax-500 text-parchment-100',
  win: 'bg-gold-400 text-wood-800',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number>();

  const push = useCallback((text: string, tone: Tone = 'ok') => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[88px] z-[70] flex justify-center px-4"
        role="status"
        aria-live="polite"
      >
        {toast && (
          <div
            key={toast.id}
            className={`flex max-w-[340px] items-center gap-3 rounded-sm border-2 bg-wood-800 px-5 py-3
                        text-[13px] leading-5 text-ink-onwood shadow-raised ${RING[toast.tone]}`}
            style={{ animation: 'wq-toast 180ms ease-out' }}
          >
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${DISC[toast.tone]}`}>
              {ICON[toast.tone]}
            </span>
            <span>{toast.text}</span>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
