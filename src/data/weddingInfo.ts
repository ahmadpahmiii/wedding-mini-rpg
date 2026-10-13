/**
 * The couple's details, from wedding.json at the repo root — or from
 * wedding.local.json when that file exists (vite.config.ts picks). Edit the
 * JSON, not this file. `npm run check` validates whichever one is in use,
 * since tsc only ever sees the public sample.
 */
import data from '@wedding' with { type: 'json' };

export interface Person {
  name: string;
  fullName: string;
  orderInFamily: string;
  fatherName: string;
  motherName: string;
  instagram: string;
  bio: string;
  attire: string;
}

export interface WeddingEvent {
  title: string;
  date: string;
  displayDate: string;
  time: string;
  venue: string;
  address: string;
  mapsUrl: string;
  dresscode: string;
}

/** Whoever answers in Ngobrol. Option 0 is the bride, 1 the groom, 2 both — unless `by` says otherwise. */
export type Speaker = 'bride' | 'groom' | 'both';
export interface NgobrolOption { label: string; response: string; by?: Speaker }
export interface Verdict { title: string; body: string }

export interface WeddingConfig {
  title: string;
  hashtag: string;
  location: { name: string; city: string };
  couple: { bride: Person; groom: Person };
  events: { akad: WeddingEvent; resepsi: WeddingEvent };
  /** Akad start with an explicit offset, so overseas guests count down to the right hour. */
  ceremonyStart: string;
  quote: { arabic: string; translation: string; source: string };
  blessing: { text: string; meaning: string; source: string };
  /** /assets/* is cached as immutable for a year: a new track needs a new file name. */
  bgmUrl: string;
  invitationBgm: { url: string; credit: string };
  ngobrol: {
    names: { bride: string; groom: string };
    title: string;
    subtitle: string;
    questions: { question: string; options: NgobrolOption[] }[];
    verdicts: { both: Verdict; tie: Verdict; bride: Verdict; groom: Verdict };
  };
}

export const wedding = data as WeddingConfig;

/** "Nadia & Raka" */
export const coupleNames = `${wedding.couple.bride.name} & ${wedding.couple.groom.name}`;
