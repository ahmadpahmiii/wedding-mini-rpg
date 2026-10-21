import { useEffect, useRef, useState, type ReactNode } from 'react';
import Modal from '../ui/Modal';
import { ngobrol, speakerOf, tally, tug, verdict, type Speaker } from '../../data/ngobrol';
import { audio, haptic } from '../../services/audio';
import type { LoadedAssets } from '../../services/assets';

const QS = ngobrol.questions;
const KEY = 'wq.ngobrol';

const { bride: BRIDE, groom: GROOM } = ngobrol.names;
const NAME: Record<Speaker, string> = { bride: BRIDE, groom: GROOM, both: `${BRIDE} & ${GROOM}` };
const TINT: Record<Speaker, string> = { bride: 'text-rose-700', groom: 'text-emerald-500', both: 'text-gold-900' };

/** Head crops of couple_pelaminan.png (900 x 672): x, y, side. */
const FACE = { groom: [323, 189, 105], bride: [470, 209, 105] } as const;

/** The pause before a line lands. A punchline that arrives instantly is not a punchline. */
const TYPING_MS = { q: 650, r: 1100 } as const;

/** Answers outlive the modal — a stray swipe on the header must not cost ten questions. */
function loadPicks(): number[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((n) => n === 0 || n === 1 || n === 2).slice(0, QS.length) : [];
  } catch {
    return [];
  }
}

function savePicks(p: number[]) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ }
}

type Turn = { kind: 'q' | 'a' | 'r'; i: number };

/** The whole conversation so far: each question, then the guest's pick and the reply to it. */
function thread(picks: number[]): Turn[] {
  const out: Turn[] = [];
  for (let i = 0; i < QS.length; i++) {
    out.push({ kind: 'q', i });
    if (picks[i] === undefined) break;
    out.push({ kind: 'a', i }, { kind: 'r', i });
  }
  return out;
}

function Face({ assets, who, size }: { assets: LoadedAssets; who: 'bride' | 'groom'; size: number }) {
  return (
    <canvas
      width={72}
      height={72}
      aria-hidden
      className="shrink-0 rounded-sm border-2 border-gold-500 bg-wood-600"
      style={{ width: size, height: size }}
      ref={(el) => {
        const ctx = el?.getContext('2d');
        if (!ctx) return;
        const [x, y, s] = FACE[who];
        ctx.clearRect(0, 0, 72, 72);
        ctx.drawImage(assets.couple, x, y, s, s, 0, 0, 72, 72);
      }}
    />
  );
}

function Said({ assets, who, strong, children }: {
  assets: LoadedAssets; who: Speaker; strong?: boolean; children: ReactNode;
}) {
  return (
    <div className="flex items-end gap-2" style={{ animation: 'wq-rise 180ms ease-out' }}>
      <span className="flex w-10 shrink-0 justify-center">
        {who === 'both' ? (
          <>
            <Face assets={assets} who="bride" size={26} />
            <span className="-ml-3 mt-[6px]"><Face assets={assets} who="groom" size={26} /></span>
          </>
        ) : (
          <Face assets={assets} who={who} size={32} />
        )}
      </span>
      <div className="grid min-w-0 max-w-[80%] gap-1">
        <span className={`text-[11px] font-bold ${TINT[who]}`}>{NAME[who]}</span>
        <div className={`rounded-lg rounded-bl-sm border-2 bg-parchment-100 px-3 py-2 text-[14px] leading-[21px]
                         text-ink-900 shadow-card ${strong ? 'border-gold-500 font-semibold' : 'border-wood-400'}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

interface Props { assets: LoadedAssets; onClose: () => void; onWish: () => void }

export default function NgobrolModal({ assets, onClose, onWish }: Props) {
  const [picks, setPicks] = useState(loadPicks);
  const [view, setView] = useState<'intro' | 'chat' | 'result'>(() =>
    picks.length === 0 ? 'intro' : picks.length === QS.length ? 'result' : 'chat');
  // A returning guest sees their past turns at once; only what comes next is typed out.
  const [shown, setShown] = useState(picks.length * 3);
  const endRef = useRef<HTMLDivElement>(null);

  const turns = thread(picks);
  const next: Turn | undefined = turns[shown];
  const waiting = view === 'chat' && !next && picks.length < QS.length;

  useEffect(() => {
    if (view !== 'chat' || !next) return;
    const t = window.setTimeout(() => {
      setShown((s) => s + 1);
      audio.play(next.kind === 'r' ? 'open' : 'click');
    }, next.kind === 'r' ? TYPING_MS.r : TYPING_MS.q);
    return () => window.clearTimeout(t);
  }, [view, shown, picks]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [view, shown]);

  const pick = (k: number) => {
    if (!waiting) return;
    const p = [...picks, k];
    setPicks(p);
    savePicks(p);
    setShown((s) => s + 1);
    audio.play('click');
    haptic(10);
  };

  const finish = () => {
    audio.play('levelup');
    haptic(18);
    setView('result');
  };

  const restart = () => {
    audio.play('click');
    setPicks([]);
    savePicks([]);
    setShown(0);
    setView('chat');
  };

  const typer: Speaker | null = view === 'chat' && next
    ? (next.kind === 'q' ? 'both' : speakerOf(next.i, picks[next.i]))
    : null;
  const pos = Math.min(94, Math.max(6, tug(picks)));

  const footer = view === 'chat' && (
    <div className="grid gap-3">
      <div className="flex min-h-[24px] items-center justify-between">
        <span className="label-cap">PERTANYAAN {Math.max(1, Math.ceil(shown / 3))} / {QS.length}</span>
        {picks.length > 0 && picks.length < QS.length && (
          <button type="button" onClick={finish} className="text-[13px] font-semibold text-ink-600 underline">
            Udahan dulu
          </button>
        )}
      </div>

      {/* Tarik tambang: no score, just which way the guest is leaning. */}
      <div className="flex items-center gap-2" role="img"
           aria-label={`Tarik tambang: ${pos < 45 ? `condong ke ${BRIDE}` : pos > 55 ? `condong ke ${GROOM}` : 'seimbang'}`}>
        <span className="font-pixel text-[8px] text-rose-700">{BRIDE.toUpperCase()}</span>
        <div className="relative h-3 flex-1 rounded-[2px] border-2 border-wood-800 bg-emerald-100">
          <span className="absolute inset-y-0 left-0 bg-rose-100 transition-[width] duration-500" style={{ width: `${pos}%` }} />
          <span
            className="absolute top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rotate-45 border-2
                       border-wood-800 bg-wax-500 transition-[left] duration-500"
            style={{ left: `${pos}%` }}
          />
        </div>
        <span className="font-pixel text-[8px] text-emerald-500">{GROOM.toUpperCase()}</span>
      </div>

      {picks.length === QS.length ? (
        <button type="button" onClick={finish} disabled={!!next} className="btn-primary w-full">
          LIHAT GELARKU ▶
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {QS[picks.length].options.map((o, k) => (
            <button
              key={k}
              type="button"
              disabled={!waiting}
              onClick={() => pick(k)}
              className="min-h-tap rounded-sm border-[3px] border-wood-800 bg-parchment-100 px-1 py-2 text-[13px]
                         font-semibold leading-4 text-ink-900 shadow-raised active:translate-y-[3px]
                         active:shadow-pressed disabled:opacity-45 disabled:shadow-none"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Modal title="Ngobrol bareng kami" icon="💬" onClose={onClose} footer={footer || undefined} tall={view === 'chat'}>
      {view === 'intro' && (
        <div className="grid justify-items-center gap-4 py-2 text-center">
          <div className="flex gap-2">
            <Face assets={assets} who="bride" size={64} />
            <Face assets={assets} who="groom" size={64} />
          </div>
          <h3 className="m-0 font-display text-[24px] font-bold leading-8 text-ink-900">{ngobrol.title}</h3>
          <p className="m-0 text-[14px] leading-[22px] text-ink-600">{ngobrol.subtitle}</p>
          <span className="label-cap">{QS.length} PERTANYAAN · ±3 MENIT · BISA UDAHAN KAPAN SAJA</span>
          <button type="button" onClick={() => { audio.play('click'); setView('chat'); }} className="btn-primary w-full">
            DUDUK DULU ▶
          </button>
        </div>
      )}

      {view === 'chat' && (
        <div className="flex flex-col gap-3">
          <div role="log" aria-label="Obrolan" className="flex flex-col gap-3">
            {turns.slice(0, shown).map(({ kind, i }) => {
              const q = QS[i];
              if (kind === 'q') return <Said key={`q${i}`} assets={assets} who="both" strong>{q.question}</Said>;
              const o = q.options[picks[i]];
              if (kind === 'a') return (
                <p key={`a${i}`} style={{ animation: 'wq-rise 180ms ease-out' }}
                   className="m-0 max-w-[75%] self-end rounded-lg rounded-br-sm border-2 border-wood-800 bg-gold-500
                              px-3 py-2 text-[14px] font-semibold leading-[21px] text-wood-800">
                  {o.label}
                </p>
              );
              return <Said key={`r${i}`} assets={assets} who={speakerOf(i, picks[i])}>{o.response}</Said>;
            })}
          </div>
          {typer && (
            <Said assets={assets} who={typer}>
              <span className="flex h-[21px] items-center gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-[6px] w-[6px] rounded-full bg-ink-muted"
                        style={{ animation: `wq-bob 0.9s ease-in-out ${d}ms infinite` }} />
                ))}
                <span className="sr-only">{NAME[typer]} sedang mengetik</span>
              </span>
            </Said>
          )}
          <div ref={endRef} />
        </div>
      )}

      {view === 'result' && <Result picks={picks} onWish={onWish} onResume={() => { audio.play('click'); setView('chat'); }} onRestart={restart} />}
    </Modal>
  );
}

function Result({ picks, onWish, onResume, onRestart }: {
  picks: number[]; onWish: () => void; onResume: () => void; onRestart: () => void;
}) {
  const v = verdict(picks);
  const [bride, groom, both] = tally(picks);
  const rows = [[BRIDE, bride, 'bg-rose-700'], [GROOM, groom, 'bg-emerald-500'], ['Dua-duanya', both, 'bg-gold-700']] as const;
  const partial = picks.length < QS.length;

  return (
    <div className="grid gap-4">
      <section className="rounded-md border-[3px] border-gold-500 bg-wood-800 p-5 text-center shadow-modal"
               style={{ animation: 'wq-rise 220ms ease-out' }}>
        <span className="font-pixel text-[8px] leading-4 tracking-[1px] text-gold-400">GELAR BARU DIDAPAT</span>
        <h3 className="mb-2 mt-2 font-display text-[24px] font-bold leading-8 text-ink-onwood">{v.title}</h3>
        <p className="m-0 text-[14px] leading-[22px] text-parchment-300">{v.body}</p>
      </section>

      <ul className="doc-card m-0 grid list-none gap-2">
        {rows.map(([label, n, bar]) => (
          <li key={label} className="flex items-center gap-3 text-[13px] font-semibold text-ink-900">
            <span className="w-[84px] shrink-0">{label}</span>
            <span className="h-2 flex-1 rounded-[2px] bg-parchment-400">
              <span className={`block h-full rounded-[2px] ${bar}`} style={{ width: `${(n / picks.length) * 100}%` }} />
            </span>
            <span className="w-5 text-right">{n}</span>
          </li>
        ))}
      </ul>
      {partial && (
        <p className="label-cap m-0 text-center">UDAHAN DI {picks.length} DARI {QS.length} PERTANYAAN</p>
      )}

      <p className="m-0 text-center text-[14px] leading-[22px] text-ink-600">
        Udah kenal kami, sekarang giliran kamu nitip doa 🤲
      </p>
      <button type="button" onClick={onWish} className="btn-primary w-full">TULIS UCAPAN ▶</button>
      {partial ? (
        <button type="button" onClick={onResume} className="btn-secondary w-full">LANJUT NGOBROL</button>
      ) : (
        <button type="button" onClick={onRestart} className="btn-secondary w-full">NGOBROL DARI AWAL</button>
      )}
    </div>
  );
}
