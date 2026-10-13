import Modal from '../ui/Modal';
import { AttendanceChip } from '../ui/Chip';
import { relativeTime, stickerUrl } from '../../services/wishes';
import type { Wish } from '../../game/types';

/** Opened by tapping a guest walking the garden. */
export default function GreetModal({ wish, onClose }: { wish: Wish; onClose: () => void }) {
  return (
    <Modal title={wish.name} icon="🙋" onClose={onClose}>
      <div className="doc-card grid gap-3">
        <time className="text-[11px] text-ink-muted">{relativeTime(wish.at)}</time>
        <p className="m-0 font-display text-[19px] leading-7 text-ink-900">“{wish.message}”</p>
        {wish.sticker && (
          <img src={stickerUrl(wish.sticker)} alt=""
               className="h-24 w-24 rounded-md border-[1.5px] border-wood-400 bg-parchment-300 object-contain p-2" />
        )}
        <AttendanceChip attending={wish.attending} guests={wish.guests} />
      </div>
    </Modal>
  );
}
