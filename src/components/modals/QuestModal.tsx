import Modal from '../ui/Modal';
import { MILESTONES, QUESTS, has, type Progress } from '../../services/progress';

interface Props {
  progress: Progress;
  /** Walk the guest to a landmark, by id. */
  onGo: (place: string) => void;
  onClose: () => void;
}

/** The quest log. Every quest is optional; the invitation never waits on one. */
export default function QuestModal({ progress, onGo, onClose }: Props) {
  return (
    <Modal title="Misi kecil" icon="⭐" onClose={onClose}>
      <p className="mb-4 mt-0 text-[13px] leading-5 text-ink-600">
        Buat seru-seruan saja. Semua bagian undangan tetap bisa dibuka kapan pun lewat menu di bawah.
      </p>
      <ul className="m-0 grid list-none gap-3 p-0">
        {QUESTS.map((q) => {
          const done = has(progress, q.flag);
          // A gift already in hand goes to the pelaminan, not back to the table.
          const place = q.flag === 'gift' && progress.held ? 'pelaminan' : q.place;
          const badge = MILESTONES[q.flag]?.name;
          return (
            <li key={q.flag} className="doc-card flex items-center gap-3">
              <span
                aria-hidden
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${
                  done ? 'border-emerald-500 bg-emerald-500 text-parchment-100' : 'border-wood-400 bg-parchment-200'
                }`}
              >
                {done ? '✓' : ''}
              </span>
              <div className="min-w-0 grow">
                <b className="block text-[14px] leading-5 text-ink-900">
                  {q.title}
                  {q.optional && <span className="label-cap ml-2">OPSIONAL</span>}
                </b>
                <span className="block text-[12px] leading-[18px] text-ink-600">
                  {done ? 'Selesai' : q.flag === 'gift' && progress.held ? 'Hadiah sudah di tangan. Bawa ke pelaminan!' : q.hint}
                </span>
                {badge && <span className="mt-1 block text-[11px] font-semibold text-gold-900">🏅 {badge}</span>}
              </div>
              {!done && place && (
                <button type="button" onClick={() => onGo(place)} className="btn-secondary shrink-0 !px-3 !py-2">
                  ANTAR
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mb-0 mt-4 text-center text-[12px] font-semibold leading-[18px] text-gold-900">
        {has(progress, 'allstar')
          ? '🏆 Kamu sudah jadi Wedding All-Star!'
          : '🏆 Selesaikan semua misi yang tidak opsional untuk jadi Wedding All-Star.'}
      </p>
    </Modal>
  );
}
