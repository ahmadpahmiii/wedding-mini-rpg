import { useEffect, useRef, type ReactNode } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { audio } from '../../services/audio';

interface Props {
  title: string;
  icon: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the scrolling body — for controls that must stay in reach. */
  footer?: ReactNode;
  /** Full height from the start, for content that grows — a chat must not push its own header up. */
  tall?: boolean;
}

/** The shell every modal shares: wood outer, header bar, scrolling parchment body. */
export default function Modal({ title, icon, onClose, children, footer, tall }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose);

  useEffect(() => {
    audio.duck(true);
    return () => audio.duck(false);
  }, []);

  // Swipe the header down to dismiss — the gesture a phone user reaches for first.
  const startY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startY.current !== null && e.changedTouches[0].clientY - startY.current > 90) onClose();
    startY.current = null;
  };

  return (
    <div
      className="fixed inset-x-0 z-50 flex items-center justify-center px-3 sm:px-5"
      style={{
        background: 'var(--veil-strong)',
        // Pinned to the VISIBLE viewport, not the layout one. On iOS Safari a
        // fixed element at top:0 sits behind the URL bar, which is what kept
        // clipping the header and its ESC button on every modal.
        top: 'var(--vv-top, 0px)',
        height: 'var(--vv-height, 100svh)',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`flex max-h-full w-full max-w-stage flex-col overflow-hidden rounded-xl
                    border-[3px] border-gold-500 bg-wood-800 shadow-modal outline-none ${tall ? 'h-full' : ''}`}
        style={{ animation: 'wq-rise 180ms ease-out' }}
      >
        <header
          className="flex h-12 shrink-0 items-center gap-3 border-b-[3px] border-wood-700 bg-wood-600 px-4"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <span
            aria-hidden
            className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-sm
                       border-2 border-gold-500 bg-parchment-200 text-[13px]"
          >
            {icon}
          </span>
          <h2 className="flex-1 truncate font-display text-[19px] font-bold text-ink-onwood">{title}</h2>
          <button
            type="button"
            onClick={() => { audio.play('close'); onClose(); }}
            className="min-h-[36px] rounded-sm border-2 border-gold-500 bg-wood-800 px-3 py-2
                       font-pixel text-[9px] text-ink-onwood active:translate-y-[3px] active:shadow-pressed"
          >
            ESC
          </button>
        </header>
        <div className="grow overflow-y-auto overscroll-contain bg-parchment-200 px-5 py-6">{children}</div>
        {footer && <div className="shrink-0 border-t-[3px] border-wood-700 bg-parchment-300 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
