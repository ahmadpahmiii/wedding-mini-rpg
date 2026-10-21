import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Preloader from './components/Preloader';
import CoverOpening from './components/CoverOpening';
import CharacterSelect from './components/CharacterSelect';
import WelcomeSheet from './components/WelcomeSheet';
import GameCanvas from './components/GameCanvas';
import TravelGame from './components/TravelGame';
import CoupleModal, { type Moment } from './components/modals/CoupleModal';
import EventsModal from './components/modals/EventsModal';
import RsvpModal from './components/modals/RsvpModal';
import NgobrolModal from './components/modals/NgobrolModal';
import PhotoboxModal from './components/modals/PhotoboxModal';
import GreetModal from './components/modals/GreetModal';
import GiftModal from './components/modals/GiftModal';
import BuffetModal from './components/modals/BuffetModal';
import AllStarModal from './components/modals/AllStarModal';
import { useToast } from './hooks/useToast';
import { useVisualViewport } from './hooks/useVisualViewport';
import { preloadAssets, type LoadedAssets } from './services/assets';
import { ownsKeyboard } from './game/input';
import { audio } from './services/audio';
import { add as addWish, load as loadWishes, PENDING_NOTE } from './services/wishes';
import { allCore, award, loadProgress, MILESTONES, saveProgress, type Flag, type Progress } from './services/progress';
import { wedding } from './data/weddingInfo';
import { giftName } from './data/gifts';
import { DEFAULT_OUTFIT, outfitOf, type OutfitId } from './data/outfits';
import type { Destination, GiftItem, Wish } from './game/types';
import type { Npc } from './game/Npc';

type Phase = 'loading' | 'cover' | 'select' | 'travel' | 'play';

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
  const [pct, setPct] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assets, setAssets] = useState<LoadedAssets | null>(null);

  const [playerName, setPlayerName] = useState(guestName);
  const [showWelcome, setShowWelcome] = useState(false);

  const [wishes, setWishes] = useState<Wish[]>([]);
  const [modal, setModal] = useState<Destination | null>(null);
  const [greeting, setGreeting] = useState<Wish | null>(null);
  const [musicOn, setMusicOn] = useState(false);
  const [needsAudioTap, setNeedsAudioTap] = useState(false);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [allStar, setAllStar] = useState(false);
  const toast = useToast();

  // Mirrored in a ref so two completions in one tick read each other's result:
  // that is what keeps a milestone from being awarded or celebrated twice.
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const progressRef = useRef(progress);
  const [outfit, setOutfit] = useState<OutfitId>(progress.outfit ?? DEFAULT_OUTFIT);
  const commit = useCallback((next: Progress) => {
    progressRef.current = next;
    setProgress(next);
    saveProgress(next);
  }, []);
  const complete = useCallback((flag: Flag) => {
    const next = award(progressRef.current, flag);
    if (!next) return;
    commit(next);
    // The finale gets its own moment rather than a toast; it waits for
    // whatever modal earned it to close.
    if (flag === 'allstar') {
      setAllStar(true);
      return;
    }
    const m = MILESTONES[flag];
    if (m) {
      audio.play('levelup');
      toast(`${m.name}: ${m.text}`, 'win');
    }
    if (allCore(next)) complete('allstar');
  }, [commit, toast]);

  const load = useCallback(() => {
    setLoadError(null);
    setPct(0);
    const started = performance.now();
    preloadAssets(setPct)
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
    document.body.classList.toggle('is-playing', phase === 'play' || phase === 'travel');
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

  const start = (picked: OutfitId, name: string) => {
    setOutfit(picked);
    commit({ ...progressRef.current, outfit: picked });
    setPlayerName(name);
    // The trip comes every time, so the flow is the same on every visit; it
    // starts on a still screen with a skip, and only moves once a ride is picked.
    setPhase('travel');
  };

  const enterVenue = () => {
    setPhase('play');
    let onboarded = false;
    try { onboarded = !!localStorage.getItem('wq.onboarded'); } catch { /* storage blocked: the getter itself throws */ }
    // Arriving is the first milestone. A first-timer gets it after the welcome
    // sheet, so the celebration is not hidden behind it.
    if (onboarded) complete('welcome');
    else setShowWelcome(true);
  };

  const dismissWelcome = () => {
    setShowWelcome(false);
    try { localStorage.setItem('wq.onboarded', '1'); } catch { /* private mode */ }
    complete('welcome');
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

  const close = useCallback(() => {
    setModal(null);
    setMoment(null);
  }, []);

  /**
   * The guest met the couple at the pelaminan. A gift in hand is handed over,
   * which completes the gift quest — with no payment anywhere in it. Either
   * way it is a greeting, and the couple's modal opens with their thanks.
   */
  const meetCouple = useCallback(() => {
    const item = progressRef.current.held;
    if (item) {
      commit({ ...progressRef.current, held: null });
      complete('gift');
    }
    complete('greeted');
    setMoment(item ? { kind: 'gift', item } : { kind: 'greet' });
    open('pasangan');
  }, [commit, complete, open]);

  /** Null puts the gift back on the table. */
  const pickGift = (item: GiftItem | null) => {
    commit({ ...progressRef.current, held: item });
    close();
    toast(item ? `${giftName(item)} di tangan. Bawa ke pelaminan, ya!` : 'Hadiah ditaruh kembali di meja', 'info');
  };

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
    return <Preloader progress={pct} error={loadError} onRetry={load} />;
  }

  return (
    <>
      {phase === 'cover' && <CoverOpening guestName={guestName} onOpened={onOpened} />}

      {phase === 'select' && (
        <CharacterSelect initialName={guestName} initialOutfit={outfit} onStart={start} />
      )}

      {phase === 'travel' && <TravelGame assets={assets} outfit={outfit} onDone={enterVenue} />}

      {phase === 'play' && (
        <>
          <GameCanvas
            assets={assets}
            outfit={outfit}
            guestName={playerName}
            wishes={wishes}
            progress={progress}
            openModal={modal}
            musicOn={musicOn}
            needsAudioTap={needsAudioTap}
            unread={wishes.length}
            onOpen={open}
            onCouple={meetCouple}
            onToggleMusic={toggleMusic}
            onEnableAudio={enableAudio}
            onGreet={greet}
          />

          {showWelcome && <WelcomeSheet onClose={dismissWelcome} />}

          {modal === 'pasangan' && (
            <CoupleModal assets={assets} moment={moment} onPhoto={() => { setMoment(null); open('photobox'); }} onClose={close} />
          )}
          {modal === 'hadiah' && <GiftModal held={progress.held} onPick={pickGift} onClose={close} />}
          {modal === 'buffet' && (
            <BuffetModal
              best={progress.buffetBest}
              onFoodie={() => complete('foodie')}
              onRoundEnd={(total) => {
                if (total > progressRef.current.buffetBest) commit({ ...progressRef.current, buffetBest: total });
              }}
              onClose={close}
            />
          )}
          {modal === 'acara' && <EventsModal onClose={close} />}
          {modal === 'rsvp' && (
            <RsvpModal
              wishes={wishes}
              defaultName={playerName}
              gender={outfitOf(outfit).body}
              onSubmit={submitWish}
              onClose={close}
            />
          )}
          {modal === 'ngobrol' && <NgobrolModal assets={assets} onClose={close} onWish={() => open('rsvp')} />}
          {modal === 'photobox' && (
            <PhotoboxModal assets={assets} outfit={outfit} onSaved={() => complete('photo')} onClose={close} />
          )}

          {greeting && <GreetModal wish={greeting} onClose={() => setGreeting(null)} />}
          {allStar && !modal && !greeting && (
            <AllStarModal onClose={() => { audio.play('close'); setAllStar(false); }} />
          )}
        </>
      )}
    </>
  );
}
