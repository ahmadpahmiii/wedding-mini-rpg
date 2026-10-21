import { useEffect, useRef, useState } from 'react';
import { Engine } from '../game/Engine';
import { ownsKeyboard } from '../game/input';
import { LANDMARKS } from '../game/landmarks';
import type { Npc } from '../game/Npc';
import type { Destination, Landmark, Wish } from '../game/types';
import { outfitOf, type OutfitId } from '../data/outfits';
import { wedding } from '../data/weddingInfo';
import { gestureFor, type Beat } from '../game/meet';
import type { LoadedAssets } from '../services/assets';
import { audio, haptic } from '../services/audio';
import { QUESTS, has, type Progress } from '../services/progress';
import GameHUD from './GameHUD';
import BottomNav from './BottomNav';
import QuestModal from './modals/QuestModal';

interface Props {
  assets: LoadedAssets;
  outfit: OutfitId;
  /** The guest's own name, for the couple to answer them by. */
  guestName: string;
  wishes: Wish[];
  progress: Progress;
  openModal: Destination | null;
  musicOn: boolean;
  needsAudioTap: boolean;
  unread: number;
  onOpen: (d: Destination) => void;
  /** Called once the meeting on the pelaminan is over and its hearts have risen. */
  onCouple: () => void;
  onToggleMusic: () => void;
  onEnableAudio: () => void;
  onGreet: (npc: Npc) => void;
}

/** Long enough for a gift to fly up and the hearts to rise before the modal covers them. */
const MEET_MS = 900;

export default function GameCanvas({
  assets, outfit, guestName, wishes, progress, openModal, musicOn, needsAudioTap, unread,
  onOpen, onCouple, onToggleMusic, onEnableAudio, onGreet,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [inRange, setInRange] = useState<Landmark | null>(null);
  const [promptHigh, setPromptHigh] = useState(false);
  const [questsOpen, setQuestsOpen] = useState(false);
  /** Where the meeting on the pelaminan has got to, for the HUD; null when there is none. */
  const [meetBeat, setMeetBeat] = useState<Beat | null>(null);
  const inRangeRef = useRef<Landmark | null>(null);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const coupleRef = useRef(onCouple);
  coupleRef.current = onCouple;
  const heldRef = useRef(progress.held);
  heldRef.current = progress.held;
  /** True from the meeting's end until its modal opens, so nothing starts another. */
  const meeting = useRef(false);
  const nameRef = useRef(guestName);
  nameRef.current = guestName;
  // The engine is built once. `wishes` changes on every RSVP, and rebuilding
  // the engine for that would reset the camera and teleport the player.
  const modalRef = useRef<Destination | 'quests' | null>(openModal);
  modalRef.current = openModal ?? (questsOpen ? 'quests' : null);

  /**
   * A or E. At the pelaminan it starts the meeting: up onto the dais, a
   * salaman held with each of the couple, the doa. Everywhere else it opens
   * that place. During the meeting the button is held, not pressed.
   */
  const interact = () => {
    const lm = inRangeRef.current;
    const engine = engineRef.current;
    if (!engine || engine.meeting || meeting.current) return;
    if (!lm) return;
    if (lm.id !== 'pelaminan') {
      openRef.current(lm.target);
      return;
    }
    audio.play('open');
    engine.startMeet(outfitOf(outfit).body, nameRef.current);
  };
  const press = (down: boolean) => {
    const engine = engineRef.current;
    if (engine?.meeting) engine.holding = down;
  };

  /** The meeting is over: the gift, if any, flies up; hearts rise; then the couple's card. */
  const meetDone = (engine: Engine) => {
    meeting.current = true;
    haptic(18);
    engine.celebrate(heldRef.current);
    window.setTimeout(() => {
      meeting.current = false;
      coupleRef.current();
    }, engine.deviceProfile.reduced ? 0 : MEET_MS);
  };
  const interactRef = useRef(interact);
  interactRef.current = interact;
  const wishesRef = useRef(wishes);
  wishesRef.current = wishes;
  const lastOwnWish = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    lastOwnWish.current = wishesRef.current.find((w) => w.mine)?.id ?? null;
    const engine = new Engine(canvas, assets, outfit, wishesRef.current, {
      onProximity: (lm) => {
        inRangeRef.current = lm;
        setInRange(lm);
        // At the photobox and the chests the player stands right where the
        // prompt sits, hidden behind it. Move the prompt out of the way.
        if (lm) setPromptHigh(engine.playerFromBottom() < 300);
        if (lm) { audio.play('open'); haptic(8); }
      },
      onNpcTap: onGreet,
      onMeet: (beat) => {
        setMeetBeat(beat && beat.kind !== 'done' ? beat : null);
        if (beat?.kind === 'react') { audio.play('warmth'); haptic(20); }
        if (beat?.kind === 'doa') { audio.play('blessing'); haptic(30); }
        if (beat?.kind === 'done') meetDone(engine);
      },
    });
    engine.held = heldRef.current; // a gift picked up before a reload is still in hand
    engineRef.current = engine;
    engine.start();

    // Watches the canvas itself. orientationchange fires before layout settles,
    // so resizing on it kept the old size and stretched the map after a rotate.
    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(canvas);

    const onKeyDown = (e: KeyboardEvent) => {
      // A form field owns the keyboard while it is focused, and the world
      // must keep its hands off: the movement keys preventDefault, which
      // silently ate every "a", "s", "d" and "w" typed into the RSVP form.
      if (ownsKeyboard(e.target)) return;
      // Nor should the player walk around behind an open modal.
      if (modalRef.current) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
        engine.player.keys.add(k);
      } else if (k === 'e' || k === 'enter') {
        if (engine.meeting) engine.holding = true;
        else if (!e.repeat) interactRef.current();
      } else if (k >= '1' && k <= '7') {
        const lm = LANDMARKS[Number(k) - 1];
        if (lm) openRef.current(lm.target);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      engine.player.keys.delete(k);
      if (k === 'e' || k === 'enter') engine.holding = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onHidden = () => { if (document.hidden) { engine.player.keys.clear(); engine.holding = false; } };
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      engine.stop();
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onHidden);
      engineRef.current = null;
      // A rebuilt world starts its guest at the gate, out of range of everything.
      inRangeRef.current = null;
      setInRange(null);
    };
  }, [assets, outfit, onGreet]);

  // Wishes are fetched while the guest is still on the envelope, but a slow
  // connection can deliver them after the world is already running.
  const seated = useRef(false);
  useEffect(() => {
    if (seated.current || !engineRef.current || wishes.length === 0) return;
    seated.current = true;
    // A wish this guest sent on an earlier visit is already theirs, not a new
    // arrival — without this it walked in through the gate a second time.
    lastOwnWish.current = wishes.find((w) => w.mine)?.id ?? null;
    engineRef.current.setGuests(wishes);
  }, [wishes]);

  // A newly sent wish walks into the garden instead of rebuilding the world.
  useEffect(() => {
    const mine = wishes.find((w) => w.mine);
    if (mine && mine.id !== lastOwnWish.current && engineRef.current) {
      lastOwnWish.current = mine.id;
      engineRef.current.addGuest(mine);
    }
  }, [wishes]);

  // Ambience pauses while a modal is open; the world itself keeps running.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.quiet = openModal !== null || questsOpen;
    // A menu opened mid-meeting means the guest has gone elsewhere.
    if (engine.quiet) engine.cancelMeet();
    if (engine.quiet) {
      // Drop anything held, or a key down at the moment a modal opened would
      // leave the player walking for as long as it stayed open.
      engine.player.keys.clear();
      engine.player.stick = { x: 0, y: 0 };
    }
  }, [openModal, questsOpen]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.held = progress.held;
  }, [progress.held]);

  // Opening from the nav also walks the player there, so closing leaves them in place.
  // Not when they are already standing at its door: they would be marched off and back.
  useEffect(() => {
    if (!openModal || !engineRef.current) return;
    if (inRangeRef.current?.target === openModal) return;
    // The photo with the couple is taken on the pelaminan, not at the kiosk.
    if (openModal === 'photobox' && inRangeRef.current?.id === 'pelaminan') return;
    const lm = LANDMARKS.find((l) => l.target === openModal);
    if (lm) engineRef.current.player.walkTo({ x: lm.sx, y: lm.sy });
  }, [openModal]);

  const goTo = (place: string) => {
    setQuestsOpen(false);
    const lm = LANDMARKS.find((l) => l.id === place);
    if (lm) engineRef.current?.player.walkTo({ x: lm.sx, y: lm.sy });
  };

  // Mid-meeting the prompt names who is being greeted and how; between
  // greetings it steps aside so the couple's words have the stage.
  const holdText = (beat: Beat) => {
    if (beat.kind !== 'hold') return '';
    const name = wedding.couple[beat.who].name.toUpperCase();
    return gestureFor(outfitOf(outfit).body, beat.who) === 'jabat'
      ? `🤝 TAHAN · SALAMAN DENGAN ${name}`
      : `🙏 TAHAN · SALAM UNTUK ${name}`;
  };
  const actionText = meetBeat ? holdText(meetBeat)
    : !inRange ? ''
    : inRange.id === 'pelaminan' ? `${progress.held ? '🎁' : '🤝'} NAIK KE PELAMINAN`
    : inRange.target === 'hadiah' ? '🎁 AMBIL HADIAH'
    : inRange.target === 'buffet' ? '🍜 RACIK MENU'
    : `💬 BUKA ${inRange.label}`;

  return (
    <div className="relative mx-auto h-full w-full max-w-stage overflow-hidden bg-wood-900">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        aria-label="Peta taman pernikahan. Gunakan menu di bawah untuk membuka setiap bagian."
        role="img"
        onPointerUp={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          engineRef.current?.handleTap(e.clientX, e.clientY);
        }}
      />
      <GameHUD
        musicOn={musicOn}
        needsAudioTap={needsAudioTap}
        actionText={actionText}
        quests={{ done: QUESTS.filter((q) => has(progress, q.flag)).length, total: QUESTS.length }}
        promptHigh={promptHigh}
        onToggleMusic={onToggleMusic}
        onEnableAudio={onEnableAudio}
        onQuests={() => { audio.play('open'); setQuestsOpen(true); }}
        onAction={interact}
        hold={meetBeat?.kind === 'hold'}
        onPress={press}
        onStick={(x, y) => { if (engineRef.current) engineRef.current.player.stick = { x, y }; }}
      />
      <BottomNav active={openModal} unread={unread} onPick={onOpen} />
      {questsOpen && <QuestModal progress={progress} onGo={goTo} onClose={() => setQuestsOpen(false)} />}
    </div>
  );
}
