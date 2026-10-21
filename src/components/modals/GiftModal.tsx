import Modal from '../ui/Modal';
import { GIFTS, GIFT_SHEET, giftIndex } from '../../data/gifts';
import { audio } from '../../services/audio';
import type { GiftItem } from '../../game/types';

/** One cell of the gift sheet, scaled by CSS. */
export function GiftIcon({ item, size }: { item: GiftItem; size: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: size,
        height: size,
        background: `url(${GIFT_SHEET}) ${-giftIndex(item) * size}px 0 / ${size * GIFTS.length}px ${size}px no-repeat`,
      }}
    />
  );
}

interface Props {
  held: GiftItem | null;
  /** Null puts the gift back on the table. */
  onPick: (item: GiftItem | null) => void;
  onClose: () => void;
}

/**
 * The gift table. Three cosmetic choices for the same quest: none stands for
 * an amount of money, and the copy says plainly that nothing is being paid.
 */
export default function GiftModal({ held, onPick, onClose }: Props) {
  return (
    <Modal title="Meja hadiah" icon="🎁" onClose={onClose}>
      <p className="mb-4 mt-0 text-[13px] leading-5 text-ink-600">
        Pilih satu hadiah, lalu bawa ke pelaminan untuk mempelai. Ini hadiah virtual di dalam game, cuma
        untuk seru-seruan — <strong>bukan pembayaran</strong>.
      </p>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {GIFTS.map((g) => {
          const on = held === g.id;
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={on}
              onClick={() => { audio.play('click'); onPick(g.id); }}
              className={`grid justify-items-center gap-2 rounded-md bg-parchment-100 px-2 py-3 ${
                on ? 'border-[3px] border-gold-500 shadow-raised-gold' : 'border-2 border-wood-400'
              }`}
            >
              <GiftIcon item={g.id} size={56} />
              <span className="text-center text-[13px] font-semibold text-ink-900">{g.name}</span>
            </button>
          );
        })}
      </div>

      {held && (
        <button type="button" onClick={() => onPick(null)} className="btn-ghost w-full">
          TARUH KEMBALI
        </button>
      )}
    </Modal>
  );
}
