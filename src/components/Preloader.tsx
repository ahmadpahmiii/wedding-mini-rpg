const SEGMENTS = 17;
const HINTS = [
  'Geser joystick untuk berjalan',
  'Dekati papan kayu untuk membuka',
  'Ketuk tamu lain untuk menyapa',
];

interface Props { progress: number; error: string | null; onRetry: () => void }

export default function Preloader({ progress, error, onRetry }: Props) {
  const pct = Math.round(progress * 100);
  const filled = Math.round(progress * SEGMENTS);
  const hint = HINTS[Math.floor(pct / 34) % HINTS.length];

  const body = (
    <div className="rounded-sm border-2 border-dashed border-wood-600 px-4 py-6 text-center">
      <h1 className="mb-6 font-pixel text-[17px] leading-[30px] text-gold-400 [text-shadow:0_3px_0_#4a2e18]">
        WEDDING<br />QUEST
      </h1>
      <div
        className="flex gap-[2px] overflow-hidden rounded-[2px] border-2 border-wood-600 bg-wood-900 p-[2px]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Memuat peta"
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <i key={i} className={`h-[14px] grow ${error ? 'bg-wax-500' : i < filled ? 'bg-gold-500' : 'bg-wood-700'}`} />
        ))}
      </div>
      <span className="mt-4 block font-pixel text-[8px] tracking-[1px] text-parchment-300">
        {error ? 'GAGAL MEMUAT' : `PREPARING THE QUEST... ${pct}%`}
      </span>
      <p className="mt-5 text-xs text-gold-400/80">
        {error ? 'Gagal memuat peta — ketuk untuk coba lagi' : hint}
      </p>
    </div>
  );

  return (
    <div className="grid h-full place-items-center bg-wood-900 p-6">
      {error ? (
        <button
          type="button"
          onClick={onRetry}
          className="w-[300px] rounded-sm border-4 border-gold-500 bg-wood-800 px-5 py-8 shadow-modal"
        >
          {body}
        </button>
      ) : (
        <div className="w-[300px] rounded-sm border-4 border-gold-500 bg-wood-800 px-5 py-8 shadow-modal">{body}</div>
      )}
    </div>
  );
}
