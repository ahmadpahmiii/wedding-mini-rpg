import { coupleNames, wedding } from '../data/weddingInfo';
import { add as addWish, isPending, load as loadWishes, PENDING_NOTE, relativeTime, stickerUrl, STICKERS } from '../services/wishes';
import { calendarUrl } from '../services/calendar';
import { audio, haptic } from '../services/audio';
import type { Wish } from '../game/types';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const body = document.body;

function h(tag: string, cls: string, text?: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

// ---------- Facts come from weddingInfo.ts, the same file the game reads ----------
const pick = (path: string): string => {
  const v = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], wedding);
  return typeof v === 'string' ? v : '';
};
$$('[data-w]').forEach((el) => {
  const text = pick(el.dataset.w!);
  el.textContent = el.hasAttribute('data-quote') ? `“${text}”` : text;
});

const IG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6" fill="currentColor"/></svg>';
$$<HTMLAnchorElement>('[data-ig]').forEach((a) => {
  const handle = pick(a.dataset.ig!);
  a.href = `https://instagram.com/${handle}`;
  a.innerHTML = IG_ICON;
  a.append(`@${handle}`);
});

for (const [key, e] of Object.entries(wedding.events)) {
  const card = $(`[data-event="${key}"]`);
  $<HTMLAnchorElement>('[data-maps]', card).href = e.mapsUrl;
  $<HTMLAnchorElement>('[data-cal]', card).href = calendarUrl(e);
}

// ---------- Gate waits for its fonts, so the text never swaps mid-animation ----------
void Promise.race([
  Promise.all([document.fonts.load('italic 300 50px "Cormorant Garamond"'), document.fonts.load('11px Marcellus')]),
  new Promise((r) => setTimeout(r, 1200)), // slow network: animate in the fallback font rather than wait
]).catch(() => undefined).finally(() => body.classList.add('ready'));

// ---------- Guest name from the link: /undangan/?to=Nama+Tamu ----------
const guestName = new URLSearchParams(location.search).get('to')?.trim().slice(0, 60) ?? '';
if (guestName) $('#guest').textContent = guestName;
$<HTMLAnchorElement>('#questLink').href = guestName ? `/?to=${encodeURIComponent(guestName)}` : '/';

// ---------- Split names into letters for the entrance ----------
$$('[data-split]').forEach((el) => {
  const text = el.textContent ?? '';
  el.textContent = '';
  [...text].forEach((c, i) => {
    const s = h('span', 'ch', c);
    s.style.setProperty('--i', String(i));
    el.append(s);
  });
});

// ---------- Music: the invitation's own track (the game keeps Sabilulungan) ----------
const SONG = wedding.invitationBgm.url;
const musicBtn = $('#music');
const credit = $('#credit');
credit.textContent = `♪ ${wedding.invitationBgm.credit}`;
let creditTimer: number | undefined;
const syncMusic = () => {
  musicBtn.setAttribute('aria-pressed', String(audio.playing));
  musicBtn.hidden = !audio.bgmAvailable;
  // The artist is credited each time the music starts, then the chip gets out of the way.
  clearTimeout(creditTimer);
  credit.classList.toggle('show', audio.playing);
  if (audio.playing) creditTimer = window.setTimeout(() => credit.classList.remove('show'), 5000);
};
musicBtn.addEventListener('click', async () => {
  if (audio.playing) audio.toggleBgm(SONG); // fades out
  else { await audio.unlock(); await audio.startBgm(SONG); }
  // toggleBgm reports what it asked for; a blocked play() must not show as playing.
  syncMusic();
});
// The page comes first, the music second. Buffering starts only once every
// image and font the page needs has arrived (window load), so 1.4 MB of audio
// never competes with the envelope and hero on a slow connection. On Save-Data
// or 2G nothing is prefetched at all: the music streams from the tap instead.
const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
const thin = !!net?.saveData || /2g/.test(net?.effectiveType ?? '');
const pageLoaded = document.readyState === 'complete'
  ? Promise.resolve()
  : new Promise<void>((r) => addEventListener('load', () => r(), { once: true }));
void pageLoaded.then(() => setTimeout(() => { if (!thin && !opened) audio.prepareBgm(SONG); }, 400));
document.addEventListener('visibilitychange', () => (document.hidden ? audio.pauseForHidden() : audio.resumeFromHidden()));

// ---------- Open: seal splits → flap opens → letter rises → push in ----------
let opened = false;
function openInvite() {
  if (opened) return;
  opened = true;
  haptic(12);
  // Both inside the tap, or iOS refuses to play.
  void audio.unlock();
  void audio.startBgm(SONG).then(syncMusic);
  body.classList.add('opening');
  setTimeout(() => {
    scrollTo(0, 0);
    body.classList.add('opened');
    // Focus was on the seal, which just became hidden; start the page from the top.
    $('main').focus({ preventScroll: true });
    setTimeout(startReveal, 300);
  }, reduce ? 0 : 2500);
}
$('#seal').addEventListener('click', openInvite);
$('#openBtn').addEventListener('click', openInvite);

// ---------- Scroll reveal ----------
function startReveal() {
  const t0 = performance.now();
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target as HTMLElement;
    // The hero's long delays (up to 1.3s) are an entrance sequence. Reached later
    // by scrolling, the portrait sat empty that long — cap them to a quick stagger.
    if (performance.now() - t0 > 1500) {
      const d = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
      if (d > 150) el.style.setProperty('--d', '150ms');
    }
    el.classList.add('in');
    io.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  $$('.rv').forEach((el) => io.observe(el));
}

// ---------- Music sits lower while QS Ar-Rum 21 is on screen ----------
// Only on change: duck() starts a fade, and an unneeded duck(false) on the first
// callback would cut across the start-up fade. No effect on iOS (JS volume is ignored there).
let ducked = false;
new IntersectionObserver(([e]) => {
  if (e.isIntersecting === ducked) return;
  ducked = e.isIntersecting;
  audio.duck(ducked);
}, { threshold: 0.35 }).observe($('.night'));

// ---------- Parallax: data-speed < 0 drifts slower (background), > 0 faster ----------
const layers = reduce ? [] : $$('[data-speed]');
let ticking = false;
function parallax() {
  ticking = false;
  const mid = innerHeight / 2;
  for (const el of layers) {
    const r = el.parentElement!.getBoundingClientRect();
    if (r.bottom < -200 || r.top > innerHeight + 200) continue;
    el.style.setProperty('--py', `${((r.top + r.height / 2 - mid) * Number(el.dataset.speed)).toFixed(1)}px`);
  }
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(parallax); } }, { passive: true });
addEventListener('resize', parallax);
parallax();

// Pointer depth on the gate and the desktop panel (mouse only — phones float instead)
if (!reduce && matchMedia('(pointer: fine)').matches) {
  const targets = [$('#gate'), $('.side')];
  addEventListener('pointermove', (e) => {
    const x = ((e.clientX / innerWidth) - 0.5) * 2;
    const y = ((e.clientY / innerHeight) - 0.5) * 2;
    targets.forEach((t) => { t.style.setProperty('--mx', x.toFixed(3)); t.style.setProperty('--my', y.toFixed(3)); });
  }, { passive: true });
}

// ---------- Countdown to akad ----------
const target = Date.parse(wedding.ceremonyStart);
const cd = ['#cdD', '#cdH', '#cdM', '#cdS'].map((s) => $(s));
function tick() {
  const s = Math.floor((target - Date.now()) / 1000);
  if (s <= 0) {
    // Opened on or after the day — a row of zeros reads as broken.
    $('.countdown').replaceChildren(h('p', 'countdown-done', 'Alhamdulillah, hari bahagia telah tiba'));
    clearInterval(timer);
    return;
  }
  [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60]
    .forEach((n, i) => { cd[i].textContent = String(n).padStart(2, '0'); });
}
const timer = setInterval(tick, 1000);
tick();

// ---------- Toast ----------
const toast = $('#toast');
let toastTimer: number | undefined;
function say(msg: string) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2800);
}

// =========================================================
// Ucapan & RSVP — same /api/wishes store as the game
// =========================================================
const PAGE = 10;
let wishes: Wish[] = [];
let shown = PAGE;
const list = $('#wishes');
const moreBtn = $<HTMLButtonElement>('#moreBtn');
const countEl = $('#wishCount');

function wishCard(w: Wish, i: number): HTMLElement {
  const el = h('article', w.mine ? 'wish mine' : 'wish');
  el.style.setProperty('--i', String(i));
  const top = h('div', 'w-top');
  top.append(h('p', 'w-name', w.name), h('time', 'w-time', relativeTime(w.at)));
  const foot = h('div', 'w-foot');
  // The RSVP answer, not proof of arrival; the party size stays with the couple.
  foot.append(h('span', w.attending ? 'w-chip' : 'w-chip no', w.attending ? 'Akan hadir' : 'Tidak hadir'));
  if (w.sticker) {
    const img = h('img', 'w-sticker') as HTMLImageElement;
    img.src = stickerUrl(w.sticker);
    img.alt = '';
    img.loading = 'lazy';
    foot.append(img);
  }
  el.append(top, h('p', 'w-msg', w.message));
  if (isPending(w)) el.append(h('p', 'w-pending', 'Belum terkirim · dikirim ulang otomatis'));
  el.append(foot);
  return el;
}

function renderWishes() {
  countEl.textContent = wishes.length ? String(wishes.length) : '';
  moreBtn.hidden = wishes.length <= shown;
  if (!wishes.length) {
    list.replaceChildren(h('p', 'empty', `Belum ada ucapan. Jadilah yang pertama mendoakan ${coupleNames}.`));
    return;
  }
  list.replaceChildren(...wishes.slice(0, shown).map(wishCard));
}

moreBtn.addEventListener('click', () => {
  const from = shown;
  shown += PAGE;
  list.append(...wishes.slice(from, shown).map((w, i) => wishCard(w, i)));
  moreBtn.hidden = wishes.length <= shown;
});

void loadWishes().then((res) => { wishes = res.wishes; renderWishes(); });

// ---------- Form ----------
const MAX_MSG = 200;
const form = $<HTMLFormElement>('#rsvpForm');
const nameIn = form.elements.namedItem('name') as HTMLInputElement;
const msgIn = form.elements.namedItem('message') as HTMLTextAreaElement;
const guestsRow = $('#guestsRow');
const guestsOut = $('#guests');
const count = $('#count');
const submitBtn = $<HTMLButtonElement>('#submitBtn');
nameIn.value = guestName.slice(0, 40);

let attending: boolean | null = null;
let guests = 1;
let sticker: string | null = null;
let touched = false;
let sending = false;
guestsRow.inert = true;

function validate(): boolean {
  const bad = { name: !nameIn.value.trim(), message: !msgIn.value.trim(), attending: attending === null };
  for (const [k, isBad] of Object.entries(bad)) {
    $(`[data-err="${k}"]`).closest('.field')!.classList.toggle('bad', touched && isBad);
  }
  return !bad.name && !bad.message && !bad.attending;
}

form.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.name !== 'attending') return;
  attending = t.value === 'yes';
  guestsRow.classList.toggle('open', attending);
  guestsRow.inert = !attending;
  validate();
});
nameIn.addEventListener('input', () => { if (touched) validate(); });
msgIn.addEventListener('input', () => {
  const n = msgIn.value.length;
  count.textContent = `${n} / ${MAX_MSG}`;
  count.classList.toggle('low', MAX_MSG - n <= 20);
  if (touched) validate();
});
$$<HTMLButtonElement>('[data-step]').forEach((b) => b.addEventListener('click', () => {
  guests = Math.min(10, Math.max(1, guests + Number(b.dataset.step)));
  guestsOut.textContent = String(guests);
}));

// Sticker tray — images only load the first time it opens (the GIFs are heavy)
const tray = $('#tray');
const trayWrap = $('#stickerTray');
const stickerBtn = $('#stickerBtn');
const stickerPick = $('#stickerPick');
trayWrap.inert = true;

function setTray(open: boolean) {
  if (open && !tray.childElementCount) {
    tray.append(...STICKERS.map((s, i) => {
      const b = h('button', '') as HTMLButtonElement;
      b.type = 'button';
      b.dataset.sticker = s;
      b.setAttribute('aria-label', `Sticker ${i + 1}`);
      b.setAttribute('aria-pressed', String(s === sticker));
      const img = new Image();
      img.src = stickerUrl(s);
      img.alt = '';
      b.append(img);
      return b;
    }));
  }
  trayWrap.classList.toggle('open', open);
  trayWrap.inert = !open;
  stickerBtn.setAttribute('aria-expanded', String(open));
}

function syncSticker() {
  stickerPick.hidden = !sticker;
  if (sticker) $<HTMLImageElement>('img', stickerPick).src = stickerUrl(sticker);
  $('#stickerLabel').textContent = sticker ? 'Ganti sticker' : 'Tambah sticker';
  $$('[data-sticker]', tray).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sticker === sticker)));
}

stickerBtn.addEventListener('click', () => setTray(!trayWrap.classList.contains('open')));
tray.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>('[data-sticker]');
  if (!b) return;
  sticker = sticker === b.dataset.sticker ? null : b.dataset.sticker!;
  syncSticker();
  setTray(false);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  touched = true;
  if (sending) return;
  if (!validate()) {
    $<HTMLElement>('.field.bad input, .field.bad textarea', form)?.focus();
    return say('Lengkapi nama, kehadiran, dan ucapan dulu ya');
  }
  sending = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Mengirim…';

  const res = await addWish({
    name: nameIn.value.trim(),
    message: msgIn.value.trim(),
    attending: attending!,
    guests: attending ? guests : 0,
    sticker,
    // ponytail: not asked (couple's call), so the API default; add a pria/wanita pill if the garden needs balance
    gender: 'pria',
  });

  sending = false;
  submitBtn.disabled = false;
  submitBtn.textContent = 'Kirim ucapan';

  const { wish } = res;
  // Refused (too long, too fast): nothing was sent, so nothing is listed — the words stay in the form.
  if (!wish) return say(res.error ?? 'Ucapan tidak bisa dikirim');

  wishes = [wish, ...wishes.filter((w) => w.id !== wish.id)];
  shown += 1;
  list.querySelector('.empty')?.remove();
  list.prepend(wishCard(wish, 0));
  countEl.textContent = String(wishes.length);

  // Queued counts as kept: the words are safe on the device, so the form clears either way.
  if (res.saved) { haptic(18); say('Ucapanmu sudah sampai. Terima kasih atas doanya'); }
  else say(PENDING_NOTE);
  msgIn.value = '';
  count.textContent = `0 / ${MAX_MSG}`;
  sticker = null;
  syncSticker();
  touched = false;
  validate();
});
