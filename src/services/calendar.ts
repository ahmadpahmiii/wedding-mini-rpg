import { coupleNames, type WeddingEvent } from '../data/weddingInfo';

const HOUR = 3_600_000;

/** "20261031T020000Z" — Google Calendar's UTC form. */
const stamp = (ms: number): string => new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, '');

/**
 * Google Calendar link for one event, shared by the game and /undangan.
 *
 * Both ends are read from the event's own "09:00 - 11:00 WIB". The game used
 * to assume every event lasted two hours, so the four-hour resepsi was saved
 * to guests' calendars as ending halfway through. Times are WIB, converted to UTC so
 * a guest abroad gets the right hour.
 */
export function calendarUrl(e: Pick<WeddingEvent, 'title' | 'date' | 'time' | 'venue' | 'address' | 'dresscode'>): string {
  const [from, to] = (e.time.match(/\d{1,2}[:.]\d{2}/g) ?? ['09:00']).map((t) => t.replace('.', ':').padStart(5, '0'));
  const start = Date.parse(`${e.date}T${from}:00+07:00`);
  const end = to ? Date.parse(`${e.date}T${to}:00+07:00`) : start + 2 * HOUR;
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${e.title} — ${coupleNames}`,
    dates: `${stamp(start)}/${stamp(end > start ? end : start + 2 * HOUR)}`,
    details: `Dresscode: ${e.dresscode}`,
    location: `${e.venue}, ${e.address}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
