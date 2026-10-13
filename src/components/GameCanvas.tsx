import { useEffect, useRef, useState } from 'react';
import { Engine } from '../game/Engine';
import { ownsKeyboard } from '../game/input';
import { LANDMARKS } from '../game/landmarks';
import type { Npc } from '../game/Npc';
import type { Destination, Gender, Landmark, Wish } from '../game/types';
import type { LoadedAssets } from '../services/assets';
import { audio, haptic } from '../services/audio';
import GameHUD from './GameHUD';
import BottomNav from './BottomNav';

interface Props {
  assets: LoadedAssets;
  gender: Gender;
  wishes: Wish[];
  openModal: Destination | null;
  musicOn: boolean;
  needsAudioTap: boolean;
  unread: number;
  onOpen: (d: Destination) => void;
  onToggleMusic: () => void;
  onEnableAudio: () => void;
  onGreet: (npc: Npc) => void;
}

export default function GameCanvas({
  assets, gender, wishes, openModal, musicOn, needsAudioTap, unread,
  onOpen, onToggleMusic, onEnableAudio, onGreet,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [inRange, setInRange] = useState<Landmark | null>(null);
  const [promptHigh, setPromptHigh] = useState(false);
  const inRangeRef = useRef<Landmark | null>(null);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  // The engine is built once. `wishes` changes on every RSVP, and rebuilding
  // the engine for that would reset the camera and teleport the player.
  const modalRef = useRef(openModal);
  modalRef.current = openModal;
  const wishesRef = useRef(wishes);
  wishesRef.current = wishes;
  const lastOwnWish = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    lastOwnWish.current = wishesRef.current.find((w) => w.mine)?.id ?? null;
    const engine = new Engine(canvas, assets, gender, wishesRef.current, {
      onProximity: (lm) => {
        inRangeRef.current = lm;
        setInRange(lm);
        // At the photobox and the chests the player stands right where the
        // prompt sits, hidden behind it. Move the prompt out of the way.
        if (lm) setPromptHigh(engine.playerFromBottom() < 300);
        if (lm) { audio.play('open'); haptic(8); }
      },
      onNpcTap: onGreet,
    });
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
        if (inRangeRef.current) openRef.current(inRangeRef.current.target);
      } else if (k >= '1' && k <= '5') {
        const lm = LANDMARKS[Number(k) - 1];
        if (lm) openRef.current(lm.target);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => engine.player.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onHidden = () => { if (document.hidden) engine.player.keys.clear(); };
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      engine.stop();
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onHidden);
      engineRef.current = null;
    };
  }, [assets, gender, onGreet]);

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
    engine.quiet = openModal !== null;
    if (openModal) {
      // Drop anything held, or a key down at the moment a modal opened would
      // leave the player walking for as long as it stayed open.
      engine.player.keys.clear();
      engine.player.stick = { x: 0, y: 0 };
    }
  }, [openModal]);

  // Opening from the nav also walks the player there, so closing leaves them in place.
  // Not when they are already standing at one of its doors: Ngobrol has two,
  // and opening it at the chests used to march the guest off to the gazebo.
  useEffect(() => {
    if (!openModal || !engineRef.current) return;
    if (inRangeRef.current?.target === openModal) return;
    const lm = LANDMARKS.find((l) => l.target === openModal);
    if (lm) engineRef.current.player.walkTo({ x: lm.sx, y: lm.sy });
  }, [openModal]);

  const action = () => {
    if (inRangeRef.current) openRef.current(inRangeRef.current.target);
  };

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
        inRange={inRange}
        promptHigh={promptHigh}
        onToggleMusic={onToggleMusic}
        onEnableAudio={onEnableAudio}
        onAction={action}
        onStick={(x, y) => { if (engineRef.current) engineRef.current.player.stick = { x, y }; }}
      />
      <BottomNav active={openModal} unread={unread} onPick={onOpen} />
    </div>
  );
}
