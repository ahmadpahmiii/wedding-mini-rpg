/**
 * True when a form control currently owns the keyboard.
 *
 * The world listens for keys on `window`, and the movement keys call
 * preventDefault(). Without this guard, typing "a", "s", "d" or "w" into the
 * RSVP name and message fields was swallowed before it ever reached the input,
 * and "e", "m", "?" and the digits opened modals or toggled music mid-sentence.
 *
 * Deliberately not a `document.activeElement` check: the event's own target is
 * what received the keystroke, which is the thing that should decide.
 */
export function ownsKeyboard(target: EventTarget | null): boolean {
  const el = target as (HTMLElement & { tagName?: string }) | null;
  if (!el || typeof el.tagName !== 'string') return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
