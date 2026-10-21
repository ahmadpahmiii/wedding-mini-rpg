import Modal from '../ui/Modal';
import { GiftIcon } from './GiftModal';
import { coupleNames, wedding, type Person } from '../../data/weddingInfo';
import { giftName } from '../../data/gifts';
import type { LoadedAssets } from '../../services/assets';
import type { GiftItem } from '../../game/types';

/** Why the modal opened at the pelaminan: a greeting, or a gift handed over. Absent from the nav. */
export type Moment = { kind: 'greet' } | { kind: 'gift'; item: GiftItem };

/**
 * The couple's thanks. Warm, and about the guest being there — never about
 * money. Then what happens next at a real resepsi: a photo with the couple.
 */
function MomentCard({ moment, onPhoto, onDone }: { moment: Moment; onPhoto: () => void; onDone: () => void }) {
  const gift = moment.kind === 'gift';
  return (
    <section className="mb-5 rounded-md border-[3px] border-gold-500 bg-parchment-100 p-4 text-center shadow-raised-gold">
      <span className="label-cap">{gift ? 'HADIAH SAMPAI' : 'SALAM DARI PELAMINAN'}</span>
      {gift && <div className="mt-3 flex justify-center"><GiftIcon item={moment.item} size={64} /></div>}
      <h3 className="mb-2 mt-2 font-display text-[21px] font-bold leading-7 text-ink-900">
        {gift ? `${giftName(moment.item)} sudah sampai 🤍` : 'Aamiin, makasih doanya! 🤲'}
      </h3>
      <p className="m-0 text-[13px] leading-[21px] text-ink-600">
        {gift
          ? 'Makasih ya sudah datang dan berbagi kebahagiaan bareng kami! Doa dan kehadiranmu sudah berarti banget.'
          : 'Senang banget kamu naik ke pelaminan. Semoga Allah membalas kebaikanmu. Yuk, foto bareng kami!'}
      </p>
      <p className="mb-4 mt-2 font-display text-[15px] italic text-ink-900">— {coupleNames}</p>
      <div className="grid gap-2">
        <button type="button" onClick={onPhoto} className="btn-primary w-full">📸 FOTO BARENG PENGANTIN</button>
        <button type="button" onClick={onDone} className="btn-secondary w-full">LANJUT JELAJAH</button>
      </div>
    </section>
  );
}

function Portrait({ assets }: { assets: LoadedAssets }) {
  return (
    <canvas
      width={600}
      height={448}
      className="mb-4 w-full rounded-md border-2 border-wood-400 bg-parchment-300 [image-rendering:pixelated]"
      ref={(el) => {
        const ctx = el?.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 600, 448);
        ctx.drawImage(assets.couple, 0, 0, 600, 448);
      }}
    />
  );
}

function PersonCard({ p, role }: { p: Person; role: string }) {
  return (
    <div className="doc-card">
      <span className="label-cap">{role}</span>
      <h3 className="mb-1 mt-1 font-display text-[19px] font-bold text-ink-900">{p.fullName}</h3>
      <p className="m-0 mb-3 text-[13px] leading-5 text-ink-600">{p.bio}</p>
      <dl className="m-0 grid gap-1 rounded-md bg-parchment-300 p-3 text-[13px]">
        <div className="flex gap-2">
          <dt className="label-cap w-10 shrink-0 pt-[2px]">AYAH</dt>
          <dd className="m-0 font-semibold text-ink-900">{p.fatherName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="label-cap w-10 shrink-0 pt-[2px]">IBU</dt>
          <dd className="m-0 font-semibold text-ink-900">{p.motherName}</dd>
        </div>
      </dl>
      <a
        href={`https://instagram.com/${p.instagram}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-tap items-center gap-2 rounded-full border-2 border-wood-400
                   bg-parchment-200 px-4 text-[13px] font-semibold text-ink-900"
      >
        <span aria-hidden>📷</span> @{p.instagram}
      </a>
    </div>
  );
}

export default function CoupleModal({ assets, moment, onPhoto, onClose }: {
  assets: LoadedAssets; moment?: Moment | null; onPhoto: () => void; onClose: () => void;
}) {
  const { groom, bride } = wedding.couple;
  return (
    <Modal title="Pasangan bahagia" icon="💑" onClose={onClose}>
      {moment && <MomentCard moment={moment} onPhoto={onPhoto} onDone={onClose} />}
      <Portrait assets={assets} />
      <p className="mb-5 text-center font-display text-[26px] font-bold italic text-ink-900">
        {bride.name} &amp; {groom.name}
      </p>

      <div className="grid gap-3">
        <PersonCard p={bride} role={bride.orderInFamily.toUpperCase()} />
        <PersonCard p={groom} role={groom.orderInFamily.toUpperCase()} />
      </div>

      <section className="mt-6 rounded-md border-2 border-wood-400 bg-parchment-100 p-4 text-center shadow-card">
        <p dir="rtl" lang="ar" className="m-0 font-arabic text-[27px] leading-[56px] text-ink-900">
          {wedding.quote.arabic}
        </p>
        <hr className="mx-auto my-4 w-16 border-0 border-t border-wood-400" />
        <p className="m-0 text-[13px] leading-[21px] text-ink-600">{wedding.quote.translation}</p>
        <span className="label-cap mt-3 block">{wedding.quote.source}</span>
      </section>

      <section className="mt-3 rounded-md border-2 border-wood-400 bg-parchment-100 p-4 text-center shadow-card">
        <p dir="rtl" lang="ar" className="m-0 font-arabic text-[21px] leading-[44px] text-ink-900">
          {wedding.blessing.text}
        </p>
        <p className="mb-0 mt-3 text-[13px] leading-[21px] text-ink-600">{wedding.blessing.meaning}</p>
        <span className="label-cap mt-3 block">{wedding.blessing.source}</span>
      </section>
    </Modal>
  );
}
