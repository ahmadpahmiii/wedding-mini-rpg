import { audio } from '../services/audio';

const ROWS = [
  { icon: '🕹️', text: 'Geser joystick di pojok kiri bawah untuk berjalan. Komputer: pakai WASD atau tombol panah.' },
  { icon: '🪧', text: 'Dekati papan kayu di setiap titik untuk membuka bagiannya.' },
  { icon: '📜', text: 'Buru-buru? Ketuk menu di bawah untuk langsung membuka bagian apa pun.' },
  { icon: '⭐', text: 'Ketuk MISI di atas untuk misi kecil: salaman dengan mempelai, antar hadiah, dan lainnya.' },
];

export default function WelcomeSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-x-0 z-[60] flex items-center justify-center px-4"
      style={{
        background: 'var(--veil-strong)',
        top: 'var(--vv-top, 0px)',
        height: 'var(--vv-height, 100svh)',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}
    >
      <div
        className="w-full max-w-[360px] rounded-lg border-4 border-gold-500 bg-parchment-200 p-5 shadow-modal"
        style={{ animation: 'wq-rise 220ms ease-out' }}
        role="dialog"
        aria-modal="true"
        aria-label="Selamat datang"
      >
        <span className="label-cap">SELAMAT DATANG</span>
        <h2 className="mb-4 mt-1 font-display text-[22px] font-bold text-ink-900">Jelajahi peta pernikahan</h2>
        <ul className="mb-5 grid gap-4">
          {ROWS.map((r) => (
            <li key={r.icon} className="flex gap-3 text-left">
              <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-sm
                                           border-[1.5px] border-wood-400 bg-parchment-300 text-base">{r.icon}</span>
              <p className="m-0 text-[13px] leading-5 text-ink-900">{r.text}</p>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => { audio.play('click'); onClose(); }} className="btn-primary w-full">
          MULAI JELAJAHI
        </button>
      </div>
    </div>
  );
}
