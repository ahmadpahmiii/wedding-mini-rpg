import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import { audio, haptic } from '../../services/audio';
import {
  BUFFET_SHEET, ICED_TEA_CELL, INGREDIENTS, MAX_ORDERS, RECIPES, ROUND_MS, VERDICTS,
  isCorrect, roundTotal, startRound, step, type Action, type IngredientId, type Recipe, type RecipeId, type Round,
} from '../../game/buffet';

const NAME = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i.name])) as Record<IngredientId, string>;
const CELL = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i.cell])) as Record<IngredientId, number>;

/** One cell of the 4 x 4 food sheet, scaled by CSS. */
function FoodIcon({ cell, size }: { cell: number; size: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: size,
        height: size,
        background: `url(${BUFFET_SHEET}) ${-(cell % 4) * size}px ${-Math.floor(cell / 4) * size}px / ${size * 4}px ${size * 4}px no-repeat`,
      }}
    />
  );
}

const slotName = (slot: IngredientId[]) => slot.map((i) => NAME[i]).join(' / ');

function RecipeList({ r, picked }: { r: Recipe; picked?: IngredientId[] }) {
  const line = (slot: IngredientId[], bonus: boolean) => {
    const on = !!picked && slot.some((i) => picked.includes(i));
    return (
      <li key={slot.join()} className={`flex items-center gap-2 ${on ? 'font-semibold text-emerald-500' : 'text-ink-600'}`}>
        <span aria-hidden className="w-3 text-center">{on ? '✓' : '○'}</span>
        {slotName(slot)}
        {bonus && <span className="label-cap">BONUS</span>}
      </li>
    );
  };
  return (
    <ul className="m-0 grid list-none gap-[2px] p-0 text-[13px] leading-5">
      {r.required.map((s) => line(s, false))}
      {r.optional.map((s) => line(s, true))}
    </ul>
  );
}

interface Props {
  best: number;
  /** The round ended with at least one correct dish. The milestone itself only lands once. */
  onFoodie: () => void;
  onRoundEnd: (total: number) => void;
  onClose: () => void;
}

/**
 * Recipe Rush. The rules live in game/buffet.ts; this draws a Round and feeds
 * it actions. Closing mid-round simply drops the round — nothing else in the
 * guest's progress depends on it, and a low score blocks nothing.
 */
export default function BuffetModal({ best, onFoodie, onRoundEnd, onClose }: Props) {
  const [round, setRound] = useState<Round | null>(null);
  const [bestBefore, setBestBefore] = useState(best);
  // The ref is the source of truth, so two taps in one frame see each other.
  const roundRef = useRef<Round | null>(null);
  const cb = useRef({ onFoodie, onRoundEnd });
  cb.current = { onFoodie, onRoundEnd };

  const act = (a: Action) => {
    const prev = roundRef.current;
    if (!prev) return;
    const next = step(prev, a);
    if (next === prev) return;
    roundRef.current = next;
    setRound(next);
    if (next.served.length > prev.served.length) {
      const good = isCorrect(next.served[next.served.length - 1].verdict);
      audio.play(good ? 'success' : 'close');
      haptic(good ? 18 : 8);
    }
    // The milestone waits for the round to end: its toast sits right over
    // SAJIKAN, and covering the button mid-round costs the guest time.
    if (next.phase === 'over' && prev.phase !== 'over') {
      if (next.served.some((s) => isCorrect(s.verdict))) cb.current.onFoodie();
      cb.current.onRoundEnd(roundTotal(next));
    }
  };

  const begin = () => {
    const r = startRound(Date.now(), Math.random() < 0.5 ? 'bakso' : 'sate');
    roundRef.current = r;
    setRound(r);
    setBestBefore(best);
    audio.play('levelup');
  };

  const playing = round?.phase === 'play';
  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => act({ type: 'tick', now: Date.now() }), 250);
    return () => window.clearInterval(t);
  }, [playing]); // act reads only refs, so a stale copy of it is harmless

  return (
    <Modal title="Prasmanan" icon="🍜" onClose={onClose} tall={playing}>
      {!round && <Intro best={best} onStart={begin} />}
      {round && playing && <Play round={round} act={act} />}
      {round && !playing && (
        <Over round={round} bestBefore={bestBefore} onAgain={begin} onDone={onClose} />
      )}
    </Modal>
  );
}

function Intro({ best, onStart }: { best: number; onStart: () => void }) {
  return (
    <div className="grid gap-4">
      <div>
        <span className="label-cap">MINIGAME</span>
        <h3 className="mb-1 mt-1 font-display text-[22px] font-bold text-ink-900">Racik Menu</h3>
        <p className="m-0 text-[13px] leading-5 text-ink-600">
          Tamu lain sedang antre! Racik tiap pesanan sesuai resep, lalu tekan SAJIKAN.
          Ada {ROUND_MS / 1000} detik untuk {MAX_ORDERS} pesanan.
        </p>
      </div>
      <div className="grid gap-2">
        {(Object.keys(RECIPES) as RecipeId[]).map((id) => (
          <div key={id} className="doc-card flex items-center gap-3 !p-3">
            <FoodIcon cell={RECIPES[id].dish} size={52} />
            <div>
              <b className="block text-[14px] text-ink-900">{RECIPES[id].name}</b>
              <RecipeList r={RECIPES[id]} />
            </div>
          </div>
        ))}
      </div>
      <p className="m-0 text-[12px] leading-[18px] text-ink-muted">
        Bahan bonus menambah skor, bahan yang tidak ada di resep menguranginya. Makin cepat, makin besar bonusnya.
      </p>
      {best > 0 && <p className="m-0 text-[13px] font-semibold text-ink-900">Skor terbaikmu: {best}</p>}
      <button type="button" onClick={onStart} className="btn-primary w-full">MULAI</button>
    </div>
  );
}

function Play({ round, act }: { round: Round; act: (a: Action) => void }) {
  const order = round.order!;
  const r = RECIPES[order.recipe];
  const left = Math.max(0, round.endsAt - round.now);
  const last = round.served[round.served.length - 1];
  const urgent = left < 10_000;

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <span className={`w-10 font-pixel text-[11px] ${urgent ? 'text-wax-500' : 'text-ink-900'}`}>
          {Math.ceil(left / 1000)}s
        </span>
        <div className="h-3 grow overflow-hidden rounded-full border-2 border-wood-400 bg-parchment-300" aria-hidden>
          <div
            className={`h-full ${urgent ? 'bg-wax-500' : 'bg-gold-500'}`}
            style={{ width: `${(100 * left) / ROUND_MS}%` }}
          />
        </div>
        <span className="font-pixel text-[9px] text-ink-900">SKOR {roundTotal(round)}</span>
      </div>

      <div aria-live="polite" className="min-h-[20px] text-center text-[12px] text-ink-600">
        {last && (
          <span>
            Pesanan tadi: <b className={isCorrect(last.verdict) ? 'text-emerald-500' : 'text-wax-500'}>
              {VERDICTS[last.verdict]}</b> +{last.points.total}
          </span>
        )}
      </div>

      <section className="doc-card flex gap-3 !p-3">
        <FoodIcon cell={r.dish} size={56} />
        <div className="min-w-0">
          <span className="label-cap">PESANAN {round.served.length + 1}/{MAX_ORDERS}</span>
          <b className="mb-1 block font-display text-[18px] leading-6 text-ink-900">{r.name}</b>
          <RecipeList r={r} picked={order.picked} />
        </div>
      </section>

      {/* Room for two rows of chips, so the shelf below does not jump under the thumb mid-tap. */}
      <section className="flex min-h-[80px] items-center gap-2 rounded-md border-2 border-dashed border-wood-400 bg-parchment-100 p-2">
        <FoodIcon cell={r.vessel} size={44} />
        {order.picked.length === 0 ? (
          <span className="text-[12px] text-ink-muted">Masih kosong. Ambil bahan di bawah.</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {order.picked.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => { audio.play('click'); act({ type: 'toggle', id }); }}
                aria-label={`Keluarkan ${NAME[id]}`}
                className="flex items-center gap-1 rounded-full border-[1.5px] border-wood-400 bg-parchment-200 py-[2px] pl-1 pr-2 text-[11px] text-ink-900"
              >
                <FoodIcon cell={CELL[id]} size={22} />
                {NAME[id]} <span aria-hidden className="text-ink-muted">✕</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-4 gap-2">
        {round.shelf.map((id) => {
          const on = order.picked.includes(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => { audio.play('click'); act({ type: 'toggle', id }); }}
              className={`grid min-h-tap justify-items-center gap-1 rounded-md px-1 py-2 ${
                on ? 'border-[3px] border-gold-500 bg-parchment-300' : 'border-2 border-wood-400 bg-parchment-100'
              }`}
            >
              <FoodIcon cell={CELL[id]} size={36} />
              <span className="text-center text-[10px] font-semibold leading-3 text-ink-900">{NAME[id]}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={order.picked.length === 0}
        onClick={() => act({ type: 'serve', now: Date.now() })}
        className="btn-primary w-full"
      >
        🍽 SAJIKAN
      </button>
    </div>
  );
}

function Over({ round, bestBefore, onAgain, onDone }: {
  round: Round; bestBefore: number; onAgain: () => void; onDone: () => void;
}) {
  const total = roundTotal(round);
  // A guest still tapping ingredients as the clock runs out would otherwise
  // land on MAIN LAGI, which sits where the shelf was, and restart by accident.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 800);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="grid gap-4 text-center">
      <div className="flex justify-center"><FoodIcon cell={ICED_TEA_CELL} size={64} /></div>
      <div>
        <h3 className="mb-1 mt-0 font-display text-[22px] font-bold text-ink-900">
          {round.served.length ? 'Prasmanan beres!' : 'Waktu habis'}
        </h3>
        <p className="m-0 text-[13px] text-ink-600">
          {round.served.length ? 'Istirahat dulu sambil minum es teh.' : 'Belum ada pesanan yang tersaji. Coba lagi, yuk!'}
        </p>
      </div>
      <p className="m-0 font-pixel text-[13px] text-ink-900">SKOR {total}</p>
      {total > bestBefore && total > 0
        ? <p className="m-0 text-[13px] font-semibold text-emerald-500">Skor terbaik baru!</p>
        : bestBefore > 0 && <p className="m-0 text-[12px] text-ink-muted">Skor terbaikmu: {bestBefore}</p>}
      {round.served.length > 0 && (
        <ul className="m-0 grid list-none gap-2 p-0 text-left">
          {round.served.map((s, i) => (
            <li key={i} className="doc-card flex items-center gap-3 !p-2">
              <FoodIcon cell={RECIPES[s.recipe].dish} size={36} />
              <div className="grow">
                <b className="block text-[13px] text-ink-900">{RECIPES[s.recipe].name}</b>
                <span className={`text-[12px] ${isCorrect(s.verdict) ? 'text-emerald-500' : 'text-wax-500'}`}>
                  {VERDICTS[s.verdict]}
                </span>
              </div>
              <span className="font-pixel text-[10px] text-ink-900">+{s.points.total}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2">
        <button type="button" onClick={onAgain} disabled={!ready} className="btn-primary w-full">MAIN LAGI</button>
        <button type="button" onClick={onDone} disabled={!ready} className="btn-secondary w-full">SELESAI</button>
      </div>
    </div>
  );
}
