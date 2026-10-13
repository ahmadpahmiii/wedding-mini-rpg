import { useCallback, useEffect, useMemo, useState } from 'react';
import Preloader from './components/Preloader';
import CoverOpening from './components/CoverOpening';
import CharacterSelect from './components/CharacterSelect';
import WelcomeSheet from './components/WelcomeSheet';
import GameCanvas from './components/GameCanvas';
import CoupleModal from './components/modals/CoupleModal';
import EventsModal from './components/modals/EventsModal';
import RsvpModal from './components/modals/RsvpModal';
import NgobrolModal from './components/modals/NgobrolModal';
import PhotoboxModal from './components/modals/PhotoboxModal';
import GreetModal from './components/modals/GreetModal';
import { ToastProvider } from './hooks/useToast';
import { useVisualViewport } from './hooks/useVisualViewport';
import { preloadAssets, type LoadedAssets } from './services/assets';
import { ownsKeyboard } from './game/input';
import { audio } from './services/audio';
import { add as addWish, load as loadWishes, PENDING_NOTE } from './services/wishes';
import { wedding } from './data/weddingInfo';
import type { Destination, Gender, Wish } from './game/types';
import type { Npc } from './game/Npc';

type Phase = 'loading' | 'cover' | 'select' | 'play';

/**
 * `?to=Nama+Tamu`. URLSearchParams already decodes both `+` and `%20`; a second
 * decodeURIComponent threw on any name containing "%" and blanked the page,
 * and turned a real "+" (sent as %2B) into a space. Never trusts the length.
 */
function guestFromUrl(): string {
  const name = new URLSearchParams(window.location.search).get('to')?.trim();
  return name ? name.slice(0, 40) : 'Tamu Undangan';
}

export default function App() {
  const guestName = useMemo(guestFromUrl, []);

  // Keeps overlays pinned to what the guest can actually see on iOS Safari.
  useVisualViewport();

  const [phase, setPhase] = useState<Phase>('loading');
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assets, setAssets] = useState<LoadedAssets | null>(null);

  const [gender, setGender] = useState<Gender>('pria');
  const [playerName, setPlayerName] = useState(guestName);
  const [showWelcome, setShowWelcome] = useState(false);

  const [wishes, setWishes] = useState<Wish[]>([]);
  const [modal, setModal] = useState<Destination | null>(null);
  const [greeting, setGreeting] = useState<Wish | null>(null);
  const [musicOn, setMusicOn] = useState(false);
  const [needsAudioTap, setNeedsAudioTap] = useState(false);

  const load = useCallback(() => {
    setLoadError(null);
    setProgress(0);
    const started = performance.now();
    preloadAssets(setProgress)
      .then(async (a) => {
        // A preloader that flashes is worse than no preloader.
        const wait = Math.max(0, 900 - (performance.now() - started));
        await new Promise((r) => setTimeout(r, wait));
        setAssets(a);
        setPhase('cover');
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'gagal'));
  }, []);

  useEffect(load, [load]);

  // Fetched while the guest is still on the envelope, so the garden is
  // populated by the time they walk into it.
  useEffect(() => {
    let alive = true;
    void loadWishes().then((r) => { if (alive) setWishes(r.wishes); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('is-playing', phase === 'play');
  }, [phase]);

  useEffect(() => {
    const onVis = () => (document.hidden ? audio.pauseForHidden() : audio.resumeFromHidden());
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (phase !== 'play') return;
    const onKey = (e: KeyboardEvent) => {
      if (ownsKeyboard(e.target)) return; // "m" belongs to whoever is typing
      if (e.key.toLowerCase() === 'm') toggleMusic();
      if (e.key === '?') setShowWelcome(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onOpened = () => {
    setPhase('select');
    // Music may still be blocked on iOS even after a real gesture.
    window.setTimeout(() => {
      setMusicOn(audio.playing);
      setNeedsAudioTap(!audio.playing && audio.bgmAvailable);
    }, 1200);
  };

  const start = (g: Gender, name: string) => {
    setGender(g);
    setPlayerName(name);
    setPhase('play');
    let onboarded = false;
    try { onboarded = !!localStorage.getItem('wq.onboarded'); } catch { /* storage blocked: the getter itself throws */ }
    if (!onboarded) setShowWelcome(true);
  };

  const dismissWelcome = () => {
    setShowWelcome(false);
    try { localStorage.setItem('wq.onboarded', '1'); } catch { /* private mode */ }
  };

  const toggleMusic = () => {
    const on = audio.toggleBgm(wedding.bgmUrl);
    setMusicOn(on);
    if (on) setNeedsAudioTap(false);
  };

  const enableAudio = async () => {
    await audio.unlock();
    await audio.startBgm(wedding.bgmUrl);
    setMusicOn(audio.playing);
    setNeedsAudioTap(!audio.playing && audio.bgmAvailable);
  };

  const open = useCallback((d: Destination) => {
    audio.play('open');
    setModal(d);
  }, []);

  const close = useCallback(() => setModal(null), []);

  const submitWish = async (w: Omit<Wish, 'id' | 'at' | 'mine'>): Promise<string | null> => {
    const res = await addWish(w);
    // A refused wish (too long, too fast) is not shown as if it were sent.
    const { wish } = res;
    if (wish) setWishes((prev) => [wish, ...prev.filter((p) => p.id !== wish.id)]);
    return res.saved ? null : (res.error ?? PENDING_NOTE);
  };

  const greet = useCallback((npc: Npc) => {
    audio.play('open');
    setGreeting(npc.wish);
  }, []);

  if (phase === 'loading' || !assets) {
    return <Preloader progress={progress} error={loadError} onRetry={load} />;
  }

  return (
    <ToastProvider>
      {phase === 'cover' && <CoverOpening guestName={guestName} onOpened={onOpened} />}

      {phase === 'select' && (
        <CharacterSelect assets={assets} initialName={guestName} onStart={start} />
      )}

      {phase === 'play' && (
        <>
          <GameCanvas
            assets={assets}
            gender={gender}
            wishes={wishes}
            openModal={modal}
            musicOn={musicOn}
            needsAudioTap={needsAudioTap}
            unread={wishes.length}
            onOpen={open}
            onToggleMusic={toggleMusic}
            onEnableAudio={enableAudio}
            onGreet={greet}
          />

          {showWelcome && <WelcomeSheet onClose={dismissWelcome} />}

          {modal === 'pasangan' && <CoupleModal assets={assets} onClose={close} />}
          {modal === 'acara' && <EventsModal onClose={close} />}
          {modal === 'rsvp' && (
            <RsvpModal
              wishes={wishes}
              defaultName={playerName}
              gender={gender}
              onSubmit={submitWish}
              onClose={close}
            />
          )}
          {modal === 'ngobrol' && <NgobrolModal assets={assets} onClose={close} onWish={() => open('rsvp')} />}
          {modal === 'photobox' && <PhotoboxModal onClose={close} />}

          {greeting && <GreetModal wish={greeting} onClose={() => setGreeting(null)} />}
        </>
      )}
    </ToastProvider>
  );
}
