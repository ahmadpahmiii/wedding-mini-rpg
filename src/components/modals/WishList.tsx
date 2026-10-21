import { AttendanceChip } from '../ui/Chip';
import { relativeTime, stickerUrl } from '../../services/wishes';
import type { Wish } from '../../game/types';

export default function WishList({ wishes }: { wishes: Wish[] }) {
  return (
    <div className="grid gap-3">
      {wishes.map((w) => (
        <article
          key={w.id}
          className={`grid gap-2 rounded-md border-2 bg-parchment-100 p-4 ${
            w.mine ? 'border-gold-500 shadow-raised-gold' : 'border-wood-400 shadow-card'
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-bold text-ink-900">{w.name}</span>
            <time className="whitespace-nowrap text-[11px] text-ink-muted">{relativeTime(w.at)}</time>
          </div>
          <p className="m-0 text-[13px] leading-[21px] text-ink-900">{w.message}</p>
          {w.sticker && (
            <img
              src={stickerUrl(w.sticker)}
              alt=""
              loading="lazy"
              className="h-16 w-16 rounded-md border-[1.5px] border-wood-400 bg-parchment-300 object-contain p-1"
            />
          )}
          <AttendanceChip attending={w.attending} />
        </article>
      ))}
    </div>
  );
}
