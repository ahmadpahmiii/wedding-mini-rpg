import Modal from '../ui/Modal';
import { coupleNames } from '../../data/weddingInfo';

const COLORS = ['#d4af37', '#e8687f', '#2d4a3e', '#7ec8e3', '#f4e07b'];
/** Fixed rather than random, so the celebration looks the same on every phone. */
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 7) * 0.18,
  dur: 2.2 + (i % 5) * 0.35,
  color: COLORS[i % COLORS.length],
  tilt: (i % 2 ? 1 : -1) * (10 + (i % 4) * 12),
}));

/**
 * The finale: shown once, when every core quest is done. Never gated on the
 * gift. Under reduced motion the confetti simply does not fall.
 */
export default function AllStarModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Wedding All-Star" icon="🏆" onClose={onClose}>
      <div className="relative overflow-hidden text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="absolute -top-4 h-3 w-2 rounded-[1px]"
              style={{
                left: `${c.left}%`,
                background: c.color,
                transform: `rotate(${c.tilt}deg)`,
                animation: `wq-confetti ${c.dur}s ${c.delay}s ease-in infinite`,
              }}
            />
          ))}
        </div>
        <div className="relative mx-auto mb-3 mt-2 grid h-24 w-24 place-items-center rounded-full border-4 border-gold-500 bg-wood-800 text-[44px] shadow-raised-gold">
          🏆
        </div>
        <span className="label-cap relative">SEMUA MISI SELESAI</span>
        <h3 className="relative mb-2 mt-1 font-display text-[24px] font-bold text-ink-900">Kamu Wedding All-Star!</h3>
        <p className="relative m-0 text-[13px] leading-[21px] text-ink-600">
          Sudah sampai di taman, salaman dengan kami, meracik menu di prasmanan, dan berfoto.
          Terima kasih sudah meramaikan hari bahagia kami. 🤍
        </p>
        <p className="relative mb-5 mt-2 font-display text-[15px] italic text-ink-900">— {coupleNames}</p>
        <button type="button" onClick={onClose} className="btn-primary relative w-full">LANJUT JELAJAH</button>
      </div>
    </Modal>
  );
}
