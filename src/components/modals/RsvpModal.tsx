import { useState } from 'react';
import Modal from '../ui/Modal';
import WishList from './WishList';
import { STICKERS, stickerUrl } from '../../services/wishes';
import { audio, haptic } from '../../services/audio';
import { useToast } from '../../hooks/useToast';
import type { Gender, Wish } from '../../game/types';

const MAX_MSG = 200;

interface Props {
  wishes: Wish[];
  defaultName: string;
  /** The body the guest picked — their character joins the garden on submit. */
  gender: Gender;
  onSubmit: (w: Omit<Wish, 'id' | 'at' | 'mine'>) => Promise<string | null>;
  onClose: () => void;
}

export default function RsvpModal({ wishes, defaultName, gender, onSubmit, onClose }: Props) {
  const toast = useToast();
  const [name, setName] = useState(defaultName);
  const [message, setMessage] = useState('');
  const [attending, setAttending] = useState<boolean | null>(null);
  const [guests, setGuests] = useState(1);
  const [sticker, setSticker] = useState<string | null>(null);
  const [tray, setTray] = useState(false);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);

  const nameBad = touched && !name.trim();
  const msgBad = touched && !message.trim();
  const attendBad = touched && attending === null;
  const ready = !!name.trim() && !!message.trim() && attending !== null;

  const submit = async () => {
    setTouched(true);
    if (!ready || sending) return;
    setSending(true);
    const problem = await onSubmit({
      name: name.trim(), message: message.trim(), attending: attending!,
      guests: attending ? guests : 0, sticker, gender,
    });
    setSending(false);
    if (problem) {
      // The words are kept either way, so say what happened without alarm.
      toast(problem, 'bad');
      return;
    }
    audio.play('success');
    haptic(18);
    toast('Ucapanmu sudah sampai — karaktermu masuk ke taman!', 'info');
    setMessage('');
    setSticker(null);
    setTouched(false);
  };

  return (
    <Modal title="Ucapan & RSVP" icon="💌" onClose={onClose}>
      <div className="grid gap-5">
        <div className="grid gap-2">
          <label htmlFor="rsvp-name" className="label-cap">NAMA KAMU</label>
          <input
            id="rsvp-name"
            className={`field ${nameBad ? '!border-wax-500' : ''}`}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          {nameBad && <span className="text-[11px] font-medium text-wax-500">Nama belum diisi</span>}
        </div>

        <div className="grid gap-2">
          <label htmlFor="rsvp-msg" className="label-cap">UCAPAN UNTUK PASANGAN</label>
          <textarea
            id="rsvp-msg"
            className={`field min-h-[88px] resize-y ${msgBad ? '!border-wax-500' : ''}`}
            value={message}
            maxLength={MAX_MSG}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex items-center justify-between">
            {msgBad ? <span className="text-[11px] font-medium text-wax-500">Ucapan belum diisi</span> : <span />}
            <span className={`text-[11px] ${MAX_MSG - message.length <= 20 ? 'font-bold text-wax-500' : 'text-ink-muted'}`}>
              {message.length} / {MAX_MSG}
            </span>
          </div>
        </div>

        <div className="grid gap-2">
          <span className="label-cap">KONFIRMASI KEHADIRAN</span>
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={attending === true}
              onClick={() => { audio.play('click'); setAttending(true); }}
              className={`pixel-btn flex-1 ${
                attending === true
                  ? 'bg-emerald-500 text-parchment-100 shadow-raised'
                  : `bg-parchment-100 text-ink-900 shadow-raised ${attending === false ? 'opacity-45' : ''}`
              }`}
            >
              AKAN HADIR
            </button>
            <button
              type="button"
              aria-pressed={attending === false}
              onClick={() => { audio.play('click'); setAttending(false); }}
              className={`pixel-btn flex-1 border-rose-700 shadow-none ${
                attending === false
                  ? 'bg-wax-500 text-parchment-100'
                  : `bg-transparent text-rose-700 ${attending === true ? 'opacity-45' : ''}`
              }`}
            >
              TIDAK HADIR
            </button>
          </div>
          {attendBad && <span className="text-[11px] font-medium text-wax-500">Pilih salah satu dulu ya</span>}
        </div>

        {attending && (
          <div className="grid gap-2">
            <span className="label-cap">JUMLAH TAMU</span>
            <div className="flex w-max items-center overflow-hidden rounded-sm border-2 border-wood-800 shadow-raised">
              <button type="button" aria-label="Kurangi" onClick={() => setGuests((g) => Math.max(1, g - 1))}
                      className="h-11 w-11 bg-parchment-100 font-pixel text-xs text-ink-900 active:bg-parchment-400">−</button>
              <span aria-live="polite" className="grid h-11 min-w-16 place-items-center border-x-2 border-wood-800
                                                   bg-parchment-300 text-[15px] font-bold text-ink-900">{guests}</span>
              <button type="button" aria-label="Tambah" onClick={() => setGuests((g) => Math.min(10, g + 1))}
                      className="h-11 w-11 bg-parchment-100 font-pixel text-xs text-ink-900 active:bg-parchment-400">+</button>
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => setTray((t) => !t)}
            aria-expanded={tray}
            className="flex min-h-tap w-max items-center gap-2 rounded-full border-[1.5px] border-dashed
                       border-wood-400 bg-parchment-100 px-4 text-[13px] text-ink-muted"
          >
            {sticker ? <img src={stickerUrl(sticker)} alt="" className="h-7 w-7 object-contain" /> : '🖼️'}
            {sticker ? 'Ganti sticker' : 'Pilih sticker'}
          </button>
          {tray && (
            <div className="grid grid-cols-5 gap-2 rounded-md border-2 border-wood-400 bg-parchment-100 p-3 sm:grid-cols-7">
              {STICKERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={`Sticker ${s}`}
                  aria-pressed={sticker === s}
                  onClick={() => { setSticker(sticker === s ? null : s); setTray(false); }}
                  className={`grid aspect-square place-items-center rounded-md border-2 p-1 ${
                    sticker === s ? 'border-gold-500 bg-parchment-300' : 'border-transparent'
                  }`}
                >
                  <img src={stickerUrl(s)} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" onClick={() => void submit()} disabled={sending} className="btn-primary w-full">
          {sending ? 'MENGIRIM…' : 'KIRIM UCAPAN & RSVP'}
        </button>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="label-cap">UCAPAN DARI PARA TAMU</span>
            <span className="label-cap">{wishes.length}</span>
          </div>
          <WishList wishes={wishes.slice(0, 40)} />
        </section>
      </div>
    </Modal>
  );
}
