import Modal from '../ui/Modal';
import { wedding, type WeddingEvent } from '../../data/weddingInfo';
import { useCountdown } from '../../hooks/useCountdown';
import { calendarUrl } from '../../services/calendar';

function Tile({ n, unit }: { n: number; unit: string }) {
  return (
    <div className="min-w-[66px] rounded-sm border-[3px] border-gold-500 bg-wood-800 px-2 py-3 text-center shadow-raised">
      <span className="block font-pixel text-[19px] leading-7 text-gold-400">{String(n).padStart(2, '0')}</span>
      <span className="mt-[5px] block font-pixel text-[7px] tracking-[1px] text-parchment-300">{unit}</span>
    </div>
  );
}

function Row({ icon, label, value, extra }: { icon: string; label: string; value: string; extra?: string }) {
  return (
    <div className="flex gap-3">
      <span aria-hidden className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-sm
                                   border-[1.5px] border-wood-400 bg-parchment-300 text-[13px]">{icon}</span>
      <div>
        <span className="label-cap mb-[2px] block">{label}</span>
        <span className="block text-[15px] font-bold leading-6 text-ink-900">{value}</span>
        {extra && <span className="block text-[13px] leading-[21px] text-ink-600">{extra}</span>}
      </div>
    </div>
  );
}

function EventCard({ e, kind }: { e: WeddingEvent; kind: 'AKAD' | 'RESEPSI' }) {
  const akad = kind === 'AKAD';
  return (
    <article className="overflow-hidden rounded-md border-2 border-wood-400 bg-parchment-100 shadow-card">
      <header className="flex flex-wrap items-center gap-3 bg-parchment-300 p-4">
        <span className={`rounded-full border-[1.5px] px-[11px] py-[5px] text-[11px] font-bold tracking-[1.4px] ${
          akad ? 'border-emerald-500 bg-emerald-100 text-emerald-500' : 'border-rose-700 bg-rose-100 text-rose-700'
        }`}>{kind}</span>
        <span className="font-display text-[19px] font-bold text-ink-900">{e.title}</span>
      </header>
      <div className="grid gap-4 p-4">
        <Row icon="📅" label="TANGGAL" value={e.displayDate} />
        <Row icon="🕘" label="WAKTU" value={e.time} />
        <Row icon="📍" label="ALAMAT" value={e.venue} extra={e.address} />
        <Row icon="👔" label="DRESSCODE" value={e.dresscode} />
      </div>
      <div className="flex gap-2 px-4 pb-4">
        <a href={e.mapsUrl} target="_blank" rel="noopener noreferrer"
           className="btn-primary flex-1 text-center">BUKA DI MAPS</a>
        <a href={calendarUrl(e)} target="_blank" rel="noopener noreferrer"
           className="btn-secondary flex-1 text-center">+ KALENDER</a>
      </div>
    </article>
  );
}

export default function EventsModal({ onClose }: { onClose: () => void }) {
  const rem = useCountdown(wedding.ceremonyStart);
  return (
    <Modal title="Kapan & di mana" icon="🗓️" onClose={onClose}>
      <div className="mb-6 grid justify-items-center gap-4">
        <span className="label-cap">MENUJU HARI BAHAGIA</span>
        {rem.past ? (
          <p className="m-0 text-center font-display text-[19px] font-bold text-ink-900">
            Alhamdulillah, telah berlangsung<br />
            <span className="text-[15px] font-normal text-ink-600">{wedding.events.akad.displayDate}</span>
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <Tile n={rem.days} unit="HARI" />
              <Tile n={rem.hours} unit="JAM" />
              <Tile n={rem.mins} unit="MENIT" />
              <Tile n={rem.secs} unit="DETIK" />
            </div>
            <p className="m-0 font-display text-[19px] font-bold text-ink-900">{wedding.events.akad.displayDate}</p>
          </>
        )}
      </div>
      <div className="grid gap-4">
        <EventCard e={wedding.events.akad} kind="AKAD" />
        <EventCard e={wedding.events.resepsi} kind="RESEPSI" />
      </div>
    </Modal>
  );
}
