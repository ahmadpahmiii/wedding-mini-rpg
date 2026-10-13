import { useEffect } from 'react';

/**
 * Publishes the actually-visible viewport as CSS custom properties.
 *
 * `dvh` was not enough on an iPhone. A `position: fixed` element on iOS Safari
 * is laid out against the LAYOUT viewport, so `top: 0` can sit behind the URL
 * bar however the height is expressed — which is why the modal header and its
 * ESC button were still being cut off. `visualViewport` reports where the
 * visible area actually starts and how tall it really is, including while the
 * bar is mid-animation or the on-screen keyboard is up.
 *
 *   --vv-top    where the visible area begins
 *   --vv-height how tall it is
 *
 * The CSS falls back to `svh` — the small viewport, URL bar showing — so the
 * worst case without JS is a little wasted space, never a clipped control.
 */
export function useVisualViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;

    const sync = () => {
      const height = vv?.height ?? window.innerHeight;
      const top = vv?.offsetTop ?? 0;
      root.style.setProperty('--vv-height', `${height}px`);
      root.style.setProperty('--vv-top', `${top}px`);
    };

    sync();
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('orientationchange', sync);
    window.addEventListener('resize', sync);
    return () => {
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('orientationchange', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);
}
