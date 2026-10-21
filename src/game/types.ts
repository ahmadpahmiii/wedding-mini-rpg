export type Gender = 'pria' | 'wanita';
export type Facing = 'down' | 'up' | 'left' | 'right';

/**
 * Galeri, Cerita and Sapa Tamu were removed by design decision. Hadiah (a
 * virtual gift to carry to the pelaminan) and the buffet are places on the map
 * only, not in the bottom nav, because they are play rather than invitation.
 */
export type Destination = 'pasangan' | 'acara' | 'rsvp' | 'ngobrol' | 'photobox' | 'hadiah' | 'buffet';

/** The virtual gifts. Cosmetic alternatives for one quest; none stands for money. */
export type GiftItem = 'amplop' | 'kado' | 'buket';

export interface Landmark {
  id: string;
  label: string;
  target: Destination;
  /** The painted object's centre — where the sign board floats. */
  x: number;
  y: number;
  /**
   * Where the player actually stands to interact. Separate from x/y because
   * every object's centre sits inside its own collision box: testing proximity
   * against the centre made half the landmarks impossible to reach on foot.
   */
  sx: number;
  sy: number;
  radius: number;
  /** Pixels above the object where the sign board floats. */
  signOffset: number;
}

export interface Vec2 { x: number; y: number }

export interface Wish {
  id: string;
  name: string;
  message: string;
  attending: boolean;
  /** Party size. Only on this guest's own wishes — the public list leaves it out. */
  guests?: number;
  sticker: string | null;
  /** Which body walks the garden for this guest. Guessing from the id put men in kebaya. */
  gender: Gender;
  at: number;
  /** True for the wish submitted by this browser, so it can be highlighted. */
  mine?: boolean;
}

export interface DeviceProfile {
  tier: 'low' | 'high';
  /** prefers-reduced-motion: no bursts or hops, and nothing waits on an animation. */
  reduced: boolean;
  particleScale: number;
  sparkles: boolean;
  shadows: boolean;
}
