import type { Wish } from './types';

/**
 * Exactly three men and two women walk the garden. Never more.
 *
 * Pure and dependency-free on purpose: the rule is worth testing on its own,
 * and the Npc class it feeds needs collision data that a test has no use for.
 */
export const NPC_MALE = 3;
export const NPC_FEMALE = 2;
/** Hard cap on how many guests are in the garden at once. */
export const NPC_CAP = NPC_MALE + NPC_FEMALE;

export function chooseGuests(wishes: Wish[]): Wish[] {
  const attending = wishes.filter((w) => w.attending);
  const men = attending.filter((w) => w.gender === 'pria').slice(0, NPC_MALE);
  const women = attending.filter((w) => w.gender === 'wanita').slice(0, NPC_FEMALE);

  // Interleaved, so the placement loop alternates sides by gender as well.
  const out: Wish[] = [];
  for (let i = 0; i < Math.max(men.length, women.length); i++) {
    if (men[i]) out.push(men[i]);
    if (women[i]) out.push(women[i]);
  }
  return out;
}

/**
 * Lets a new arrival in without breaking the cap — someone leaves as they
 * enter. Used when a guest sends their RSVP and their character walks in.
 */
export function admit<T>(guests: T[], arrival: T): T[] {
  while (guests.length >= NPC_CAP) guests.shift();
  guests.push(arrival);
  return guests;
}
