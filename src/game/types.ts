export type Gender = 'pria' | 'wanita';
export type Facing = 'down' | 'up' | 'left' | 'right';

/** Galeri, Cerita, Sapa Tamu and Hadiah were each removed by design decision. */
export type Destination = 'pasangan' | 'acara' | 'rsvp' | 'ngobrol' | 'photobox';

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
  guests: number;
  sticker: string | null;
  /** Which body walks the garden for this guest. Guessing from the id put men in kebaya. */
  gender: Gender;
  at: number;
  /** True for the wish submitted by this browser, so it can be highlighted. */
  mine?: boolean;
}

export interface DeviceProfile {
  tier: 'low' | 'high';
  particleScale: number;
  sparkles: boolean;
  shadows: boolean;
}
