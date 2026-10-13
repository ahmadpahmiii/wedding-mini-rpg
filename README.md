# Wedding Quest

Undangan pernikahan digital berbentuk **game RPG 16-bit**. Tamu membuka segel
amplop, memilih karakter, lalu berjalan-jalan di taman pernikahan untuk
menyapa mempelai, melihat jadwal acara, mengirim ucapan & RSVP, main kuis
"Ngobrol", dan berfoto di photobox.

Ada dua halaman:

| Halaman | Isi |
| --- | --- |
| `/` | Game: peta taman, karakter, 5 tempat yang bisa didatangi |
| `/undangan/` | Undangan klasik yang di-scroll: amplop, ayat, profil mempelai, jadwal, countdown, form ucapan |

Keduanya membaca data dari **satu file**: `wedding.json`. Kamu tidak perlu
menyentuh HTML atau kode untuk mengganti nama, tanggal, lokasi, dan lainnya.

> Data di repo ini (Nadia & Raka, Gedung Serbaguna Melati, dst.) adalah
> **contoh fiktif**. Ganti dengan datamu sendiri.

---

## Daftar isi

1. [Yang perlu disiapkan](#1-yang-perlu-disiapkan)
2. [Jalankan di komputer](#2-jalankan-di-komputer)
3. [Ganti informasi pernikahan](#3-ganti-informasi-pernikahan-weddingjson)
4. [Ganti gambar, musik, dan asset lain](#4-ganti-gambar-musik-dan-asset-lain)
5. [Database ucapan & RSVP](#5-database-ucapan--rsvp)
6. [Online-kan di Vercel](#6-online-kan-di-vercel)
7. [Bagikan undangan](#7-bagikan-undangan)
8. [Checklist sebelum disebar](#8-checklist-sebelum-disebar)
9. [Masalah yang sering terjadi](#9-masalah-yang-sering-terjadi)
10. [Untuk developer](#10-untuk-developer)

---

## 1. Yang perlu disiapkan

| Kebutuhan | Keterangan |
| --- | --- |
| **Node.js 22.18 atau lebih baru** | Cek dengan `node -v`. Unduh di <https://nodejs.org> (pilih versi LTS). |
| **Git** | Untuk mengunduh project ini. |
| **Editor teks** | Misalnya VS Code, untuk mengedit `wedding.json`. |
| **Akun Vercel** (gratis) | Untuk meng-online-kan undangan. <https://vercel.com> |
| **Database Postgres** (gratis) | Untuk menyimpan ucapan & RSVP. Neon (lewat Vercel) atau Supabase. |
| **Gambar & musik milikmu** | Lihat [bagian 4](#4-ganti-gambar-musik-dan-asset-lain). Boleh pakai asset contoh dulu. |

---

## 2. Jalankan di komputer

```bash
git clone https://github.com/ahmadpahmiii/wedding-mini-rpg.git
```

```bash
cd wedding-mini-rpg
```

```bash
npm install
```

```bash
npm run dev
```

Lalu buka di browser:

- Game: <http://localhost:3000/?to=Budi+Santoso>
- Undangan: <http://localhost:3000/undangan/?to=Budi+Santoso>

`?to=` adalah nama tamu yang muncul di amplop. Setiap perubahan di
`wedding.json` langsung terlihat setelah halaman di-refresh.

Tanpa database, daftar ucapan memakai data contoh dari `src/data/seedWishes.ts`.
Itu normal. Lihat [bagian 5](#5-database-ucapan--rsvp) untuk menyambungkan
database.

---

## 3. Ganti informasi pernikahan (`wedding.json`)

Buka `wedding.json` di root project dan ganti isinya. Jangan ubah **nama
field** (teks sebelum titik dua); cukup ganti **nilainya**.

### 3.1 Informasi umum

| Field | Contoh | Muncul di |
| --- | --- | --- |
| `title` | `"The Wedding of Nadia & Raka"` | Judul tab browser & preview link WhatsApp |
| `hashtag` | `"#NadiaRakaQuest"` | Penutup halaman undangan |
| `location.name` | `"Gedung Serbaguna Melati"` | Deskripsi preview link |
| `location.city` | `"Bandung, Jawa Barat"` | Preview link & panel samping undangan (desktop) |
| `ceremonyStart` | `"2027-06-12T08:00:00+07:00"` | Countdown. Format wajib `YYYY-MM-DDTHH:MM:SS+zona`. WIB `+07:00`, WITA `+08:00`, WIT `+09:00` |

### 3.2 Mempelai: `couple.bride` (wanita) & `couple.groom` (pria)

| Field | Contoh | Keterangan |
| --- | --- | --- |
| `name` | `"Nadia"` | Nama panggilan. Dipakai di amplop, frame foto, judul, monogram (huruf pertamanya) |
| `fullName` | `"Nadia Ayu Lestari"` | Nama lengkap di profil |
| `orderInFamily` | `"Putri pertama dari"` | Baris di atas nama orang tua |
| `fatherName` | `"Bapak Hendra Wijaya"` | Tambahkan `(alm)` jika perlu |
| `motherName` | `"Ibu Sri Wahyuni"` | |
| `instagram` | `"nadia.lestari"` | **Tanpa** `@` |
| `bio` | `"Penyuka kopi susu..."` | Kalimat singkat di profil game |
| `attire` | `"Kebaya Putih, Hijab Putih"` | Busana di profil game |

### 3.3 Acara: `events.akad` & `events.resepsi`

| Field | Contoh | Keterangan |
| --- | --- | --- |
| `title` | `"Akad Nikah"` | |
| `date` | `"2027-06-12"` | Format wajib `YYYY-MM-DD`. Dipakai untuk kalender. Tanggal di amplop & frame foto diambil dari `date` milik **akad** |
| `displayDate` | `"Sabtu, 12 Juni 2027"` | Tanggal yang dibaca tamu |
| `time` | `"08:00 - 10:00 WIB"` | Jam mulai & selesai dibaca untuk "Simpan ke Kalender" (dianggap WIB) |
| `venue` | `"Masjid Contoh"` | |
| `address` | `"Jl. Contoh Raya No. 12, ..."` | Alamat lengkap |
| `mapsUrl` | `"https://maps.app.goo.gl/..."` | Link Google Maps. Di Google Maps: **Bagikan → Salin link** |
| `dresscode` | `"Batik / Pakaian Formal"` | |

### 3.4 Ayat & doa

`quote` (ayat pembuka, mis. QS. Ar-Rum: 21) dan `blessing` (doa penutup)
masing-masing berisi teks Arab, arti, dan sumber. Boleh diganti dengan kutipan
lain.

### 3.5 Musik

| Field | Keterangan |
| --- | --- |
| `bgmUrl` | Musik game, mis. `"/assets/audio/bgm.m4a"` |
| `invitationBgm.url` | Musik halaman `/undangan/` |
| `invitationBgm.credit` | Kredit lagu yang tampil sebentar saat musik mulai |

File musik ada di `public/assets/audio/`. Lihat [bagian 4.4](#44-musik).

### 3.6 Kuis "Ngobrol bareng kami": `ngobrol`

Tamu ditanya "Siapa yang paling...?" lalu memilih salah satu dari tiga
jawaban. Yang ditunjuk akan "membalas" dengan jawabannya.

| Field | Keterangan |
| --- | --- |
| `names.bride` / `names.groom` | Nama panggilan di kuis (boleh beda dengan `couple.*.name`) |
| `title`, `subtitle` | Judul & pengantar kuis |
| `questions` | Daftar pertanyaan, berapa pun jumlahnya |
| `verdicts` | Gelar di akhir kuis: `both` (paling sering pilih dua-duanya), `tie` (seri), `bride` (lebih sering pilih wanita), `groom` (lebih sering pilih pria) |

Setiap pertanyaan **wajib punya tepat 3 pilihan, dengan urutan tetap**:

```json
{
  "question": "Siapa yang lebih sering telat? ⏰",
  "options": [
    { "label": "Nadia",      "response": "Jawaban dari mempelai wanita" },
    { "label": "Raka",       "response": "Jawaban dari mempelai pria" },
    { "label": "Dua-duanya", "response": "Jawaban dari berdua" }
  ]
}
```

Pilihan ke-1 dijawab mempelai wanita, ke-2 oleh pria, ke-3 oleh berdua. Kalau
jawabannya ingin keluar dari mulut orang lain (mis. pilih "Raka" tapi yang
menjawab Nadia karena cemburu), tambahkan `"by"`: `"bride"`, `"groom"`, atau
`"both"`.

```json
{ "label": "Raka", "response": "Hmm... sebenarnya aku 😌", "by": "bride" }
```

### 3.7 Cek isian

```bash
npm run check
```

Kalau ada yang salah, semua kesalahan ditampilkan sekaligus, misalnya:

```text
✗ wedding.json perlu dibenahi:
  - couple.bride.fullName: belum diisi
  - events.akad.date: format harus YYYY-MM-DD, contoh "2027-06-12"
  - couple.groom.instagram: tulis tanpa "@"
```

`npm run build` juga menjalankan pengecekan ini, jadi data yang salah tidak
akan ikut ter-deploy.

### 3.8 Menyimpan data asli tanpa ikut ke GitHub (opsional)

Repo GitHub publik bisa dibaca siapa saja. Kalau tidak ingin data aslimu ikut
masuk ke repo:

```bash
cp wedding.json wedding.local.json
```

Isi data asli di `wedding.local.json`, dan biarkan `wedding.json` tetap berisi
contoh. File `wedding.local.json` sudah ada di `.gitignore`. **Kalau file ini
ada, build otomatis memakainya** dan mengabaikan `wedding.json`.

Perhatikan cara deploy-nya ([bagian 6](#6-online-kan-di-vercel)):

- Deploy dengan **Vercel CLI** dari laptop: `wedding.local.json` ikut terkirim. ✅
- Deploy **otomatis dari GitHub**: file ini tidak ada di GitHub, jadi situs
  akan menampilkan data contoh. ❌ Untuk cara ini, isi data asli langsung di
  `wedding.json`.

### 3.9 Apa saja yang ikut berubah otomatis

Dari `wedding.json`, semua ini ikut menyesuaikan:

- judul tab, deskripsi, dan preview link (WhatsApp/Instagram/Telegram) untuk kedua halaman
- amplop pembuka game: nama, tanggal, monogram inisial di segel
- tiga frame photobox: nama & tanggal
- halaman `/undangan/`: semua teks, link Instagram, Google Maps, dan kalender
- countdown, kalender Google, nama file foto photobox
- kuis Ngobrol

<details>
<summary>Cara kerjanya (untuk yang ingin mengubah HTML/SVG)</summary>

`index.html`, `undangan/index.html`, `public/assets/ui/cover_envelope.svg`,
dan tiga file di `public/assets/frames/` berisi token seperti
`{{couple.bride.name}}`. Saat `npm run dev` dan `npm run build`, token itu
diisi dari `wedding.json` oleh plugin kecil di `vite.config.ts`.

| Token | Hasil |
| --- | --- |
| `{{path.ke.field}}` | Nilai field apa pun dari `wedding.json`, mis. `{{events.resepsi.venue}}` |
| `{{date.long}}` | `12 Juni 2027` (dari `events.akad.date`) |
| `{{date.short}}` | `12 Jun 2027` |
| `{{date.dots}}` | `12 · 06 · 2027` |
| `{{...\|upper}}` | Huruf besar, mis. `{{date.long\|upper}}` → `12 JUNI 2027` |
| `{{...\|initial}}` | Huruf pertama, mis. `{{couple.bride.name\|initial}}` → `N` |

Token yang salah ketik membuat build gagal dengan pesan yang menyebut
tokennya, jadi kesalahan tidak lolos diam-diam. Kalau ingin SVG lain ikut
diisi, tambahkan path-nya ke daftar `TEMPLATED` di `vite.config.ts`.
</details>

---

## 4. Ganti gambar, musik, dan asset lain

Cara paling aman: **timpa file dengan nama yang sama** dan ukuran/proporsi yang
sama. Dengan begitu tidak ada kode yang perlu diubah.

> Semua file di `/assets/*` di-cache browser selama setahun. Kalau mengganti
> file **setelah undangan online**, pakai nama file baru lalu perbarui
> rujukannya. Kalau tidak, tamu yang pernah membuka undangan tetap melihat
> versi lama.

Tips umum: kompres gambar sebelum dipakai (mis. <https://squoosh.app>), WebP
untuk ilustrasi, JPG untuk foto/peta. Undangan dibuka di HP dengan sinyal
seadanya.

### 4.1 Halaman undangan (`src/undangan/img/`)

| File | Ukuran | Dipakai untuk |
| --- | --- | --- |
| `couple.webp` | 800 × 1071 | Ilustrasi pasangan di lengkung (hero) |
| `groom.webp`, `bride.webp` | 600 × 600 | Potret dalam karangan bunga di profil |
| `wax-seal.webp` | 320 × 320 | Segel lilin di amplop pembuka. **Berisi monogram inisial, ganti dengan inisialmu** |
| `envelope-photo.webp` | 1200 × 896 | Foto amplop di panel samping (layar desktop). Juga ada monogram |
| `corner.webp` | 600 × 600 | Ornamen sudut |
| `divider.webp` | 600 × 250 | Pemisah antar bagian |
| `bismillah.webp` | 800 × 308 | Kaligrafi pembuka |
| `mihrab.webp` | 760 × 1018 | Latar bagian ayat |
| `badge-akad.webp`, `badge-resepsi.webp` | 300 × 300 | Ikon kartu acara |

Ilustrasi berlatar terang yang menyatu dengan kertas krem paling cocok.
`divider`, `bismillah`, `groom`, dan `bride` digambar seperti tinta di atas
kertas, jadi latar putih polos akan berbaur sendiri.

### 4.2 Game (`public/assets/`)

| File | Ukuran | Dipakai untuk |
| --- | --- | --- |
| `map/world_map_base.jpg` | **768 × 1376** | Peta taman dari atas. Pelaminan, panggung, air mancur, gazebo, pohon harapan, kios photobox, dan meja hadiah dilukis langsung di gambar ini, termasuk pasangan di pelaminan |
| `characters/guest_characters_spritesheet.jpg` | 1200 × 896 | Karakter tamu (lihat di bawah) |
| `characters/couple_pelaminan.jpg` | 1200 × 896 | Gambar pasangan di modal "Pasangan" & wajah di kuis Ngobrol |

**Spritesheet tamu**: grid 8 kolom × 4 baris, tiap sel 150 × 224 px.

| Baris | Isi |
| --- | --- |
| 0 | Pria: menghadap depan (kolom 0–1), menghadap belakang (kolom 4–5) |
| 1 | Pria: jalan ke samping **menghadap kiri** (kolom 2–3); arah kanan dicerminkan otomatis |
| 2 | Wanita: seperti baris 0 |
| 3 | Wanita: seperti baris 1 |

Latar spritesheet dan `couple_pelaminan.jpg` boleh **putih/abu-abu terang
polos atau kotak-kotak transparan**. Latar ini dihapus otomatis saat dimuat
(`src/services/assets.ts`). Latar berwarna tidak akan terhapus.

**Wajah di kuis Ngobrol** dipotong dari `couple_pelaminan.jpg`. Kalau gambar
pasangan diganti, sesuaikan koordinat kepala (x, y, sisi) di
`FACE` dalam `src/components/modals/NgobrolModal.tsx`.

**Kalau peta diganti** dengan tata letak berbeda, koordinatnya juga harus
diukur ulang di `src/game/landmarks.ts`:

- `LANDMARKS`: posisi tiap tempat (`x, y`), titik berdiri tamu (`sx, sy`), dan modal yang dibuka (`target`)
- `BLOCKERS`: kotak yang tidak bisa dilewati, format `[x, y, lebar, tinggi]`
- `SPAWN`: titik awal tamu
- `WORLD_W`, `WORLD_H`: ukuran peta

Buka peta di editor gambar, arahkan kursor ke tiap objek, catat koordinat
pikselnya. Setelah itu jalankan `npm run check`: pengecekan akan menolak titik
berdiri yang terjebak di dalam objek atau terlalu dekat ke tempat lain.

### 4.3 Amplop, frame foto, ikon (`public/assets/`)

| File | Ukuran (viewBox) | Catatan |
| --- | --- | --- |
| `ui/cover_envelope.svg` | 500 × 350 | Amplop pembuka game. Nama, tanggal, dan monogram diisi dari token |
| `frames/frame_*.svg` | 600 × 800 | Tiga frame photobox. Kotak foto (`<rect>`) harus sama persis dengan `win` di `src/data/photoFrames.ts`; `npm run check` memastikannya |
| `icons/nav_*.svg` | 32 × 32 | Ikon menu bawah. `nav_pasangan.svg` juga jadi favicon |
| `ui/*.svg` lainnya | | Tombol, joystick, bingkai modal |

### 4.4 Musik

| File | Dipakai untuk |
| --- | --- |
| `public/assets/audio/bgm.m4a` | Musik game |
| `public/assets/audio/nour-el-ein-oud.m4a` | Musik halaman `/undangan/` |

- Format **AAC (.m4a)**, 64–96 kbps, mono cukup. Durasi 1–3 menit sudah cukup karena musik diputar berulang.
- Contoh konversi dengan ffmpeg:

  ```bash
  ffmpeg -i lagu.mp3 -t 180 -ac 1 -c:a aac -b:a 64k public/assets/audio/lagu-kami.m4a
  ```

- Perbarui `bgmUrl` / `invitationBgm` di `wedding.json` ke nama file baru.
- Pakai lagu yang boleh kamu gunakan, dan cantumkan kreditnya di `invitationBgm.credit`.

### 4.5 Preview link (`public/assets/`)

| File | Ukuran | Dipakai untuk |
| --- | --- | --- |
| `og-cover.jpg` | 1200 × 630 | Gambar preview saat link game dibagikan |
| `og-undangan.jpg` | 1200 × 630 | Gambar preview link `/undangan/`. Foto contohnya memuat monogram inisial |

Simpan sebagai JPG di bawah ~300 KB agar WhatsApp mau menampilkannya. Preview
juga butuh `VITE_SITE_URL` ([bagian 6](#6-online-kan-di-vercel)).

### 4.6 Sticker ucapan (`public/assets/stickers/`)

Sticker `.svg` atau `.gif` yang bisa dipilih tamu. Untuk menambah atau
menghapus, ubah daftar `STICKERS` di **dua tempat** sekaligus:
`src/services/wishes.ts` dan `api/_store.ts`. Server menolak sticker yang
tidak ada di daftarnya.

### 4.7 Ucapan contoh (`src/data/seedWishes.ts`)

Daftar ucapan fiktif yang tampil saat database belum tersambung atau sedang
tidak bisa dihubungi. Silakan ganti, atau kosongkan.

### 4.8 Membuat asset dengan AI (opsional)

Semua asset contoh dibuat dengan gaya **pixel art 16-bit** (game) dan
**ilustrasi cat air/line art emas** (undangan). Kalau membuat sendiri dengan
generator gambar, sebutkan gaya, sudut pandang, dan latar di prompt. Misalnya
untuk peta: *"top-down 16-bit pixel art wedding garden, portrait 768x1376,
pelaminan at top, fountain in the middle, flower arch entrance at bottom"*.
Untuk spritesheet: *"8x4 sprite sheet, 150x224 cells, plain light grey
background"*. Biasanya tetap perlu dirapikan manual agar ukurannya pas.

---

## 5. Database ucapan & RSVP

Ucapan dan konfirmasi kehadiran disimpan di Postgres lewat satu fungsi
serverless, `api/wishes.ts`. Tabelnya **dibuat otomatis** pada permintaan
pertama, jadi tidak perlu migrasi.

1. Di dashboard Vercel project kamu: **Storage → Create Database → Neon**.
   Vercel otomatis mengisi `DATABASE_URL`. Pakai connection string **pooled**
   (host berakhiran `-pooler`, atau Supabase "Transaction pooler" port 6543).
2. **Settings → Environment Variables**: tambahkan `SENDER_SALT` berisi teks
   acak yang panjang. Dipakai untuk membatasi spam tanpa menyimpan alamat IP.

Untuk mencoba database di komputer tanpa memasang apa pun:

```bash
npm run dev:api
```

Jalankan berdampingan dengan `npm run dev`. API berjalan di port 3001 dengan
Postgres di dalam memori.

Melihat daftar tamu (di SQL editor Neon/Supabase):

```sql
select * from rsvp_summary;                        -- ringkasan: jumlah hadir, kursi, ucapan
select * from wishes order by created_at desc;     -- semua ucapan
```

Skema lengkap untuk dijalankan manual: `npm run db:sql`.

---

## 6. Online-kan di Vercel

### Environment variables

| Nama | Wajib | Isi |
| --- | --- | --- |
| `DATABASE_URL` | Ya | Otomatis dari Vercel Storage (Neon) |
| `SENDER_SALT` | Ya | Teks acak panjang |
| `VITE_SITE_URL` | Ya, untuk preview link | Alamat situsmu tanpa `/` di akhir, mis. `https://nadia-raka.vercel.app` |

Lihat `.env.example`. Untuk build dari laptop, `VITE_SITE_URL` bisa ditulis di
`.env.production` (sudah di-gitignore).

### Cara A: Vercel CLI dari laptop

Cocok kalau kamu memakai `wedding.local.json`.

```bash
npm install -g vercel
```

```bash
vercel login
```

```bash
vercel link
```

Atur environment variables di dashboard (atau `vercel env add`), lalu:

```bash
vercel --prod
```

### Cara B: otomatis dari GitHub

1. Buat repo milikmu sendiri dari project ini (fork, atau upload ulang).
2. Isi data asli di **`wedding.json`** (bukan `wedding.local.json`), commit, push.
3. Di Vercel: **Add New → Project → Import** repo tersebut. Framework, build
   command, dan output sudah diatur di `vercel.json`.
4. Atur environment variables, lalu **Deploy**. Setiap push berikutnya otomatis
   ter-deploy.

Setelah online, isi `VITE_SITE_URL` dengan domain final, lalu deploy ulang
supaya preview link memakai alamat yang benar.

---

## 7. Bagikan undangan

Buat link per tamu dengan menambahkan `?to=`:

```text
https://nadia-raka.vercel.app/?to=Budi+Santoso
https://nadia-raka.vercel.app/undangan/?to=Keluarga+Bapak+Hendra
```

Spasi ditulis `+` atau `%20`. Nama tamu muncul di amplop, lalu otomatis terisi
sebagai nama karakter di game dan di form ucapan `/undangan/`. `/undangan/` juga punya tombol masuk ke game.

---

## 8. Checklist sebelum disebar

- [ ] `npm run check` lolos tanpa error
- [ ] Nama, tanggal, jam, alamat, dan link Maps sudah benar (buka link Maps-nya!)
- [ ] `ceremonyStart` sesuai jam akad dan zona waktunya
- [ ] Segel lilin & foto amplop sudah memakai inisialmu (`wax-seal.webp`, `envelope-photo.webp`, `og-undangan.jpg`)
- [ ] Musik sudah diganti dan kreditnya benar
- [ ] `VITE_SITE_URL` sudah diisi, dan preview link sudah dicoba dikirim ke diri sendiri di WhatsApp
- [ ] Database tersambung: kirim 2–3 ucapan sungguhan. Karakter yang berjalan di taman diambil dari tamu yang mengisi RSVP "hadir"
- [ ] Dicoba di iPhone (Safari) dan Android (Chrome), dengan suara menyala

---

## 9. Masalah yang sering terjadi

| Gejala | Penyebab & solusi |
| --- | --- |
| Build gagal: `{{...}}: "..." is not a text field` | Token di HTML/SVG salah ketik, atau field-nya tidak ada di `wedding.json` |
| `✗ wedding.json perlu dibenahi` | Ikuti daftar yang ditampilkan. Biasanya field terhapus, atau format tanggal salah |
| `wedding.json bukan JSON yang valid` | Ada koma berlebih/kurang atau tanda kutip yang belum ditutup. Cek di <https://jsonlint.com> |
| Preview link di WhatsApp berupa kotak abu-abu | `VITE_SITE_URL` belum diisi, atau gambar OG terlalu besar |
| Situs online masih menampilkan data contoh | Deploy dari GitHub tidak membawa `wedding.local.json`. Isi data di `wedding.json`, atau deploy lewat Vercel CLI |
| Gambar/musik baru tidak muncul untuk sebagian orang | Cache setahun. Pakai nama file baru ([bagian 4](#4-ganti-gambar-musik-dan-asset-lain)) |
| Karakter punya latar kotak-kotak | Latar spritesheet bukan abu-abu/putih terang polos |
| Tamu menabrak udara / menembus objek setelah ganti peta | Sesuaikan `BLOCKERS` di `src/game/landmarks.ts` |
| Ucapan tidak tersimpan | Cek `DATABASE_URL` (harus yang pooled) dan log fungsi di dashboard Vercel |

---

## 10. Untuk developer

### Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server pengembangan di :3000 |
| `npm run dev:api` | API ucapan + Postgres in-memory di :3001 |
| `npm run check` | Validasi `wedding.json` + geometri peta + API ucapan |
| `npm run build` | Typecheck → check → build produksi ke `dist/` |
| `npm run preview` | Menyajikan hasil build di :4173 |
| `npm run db:sql` | Mencetak skema SQL |

### Struktur

```text
wedding.json      Semua data pernikahan (wedding.local.json menimpanya bila ada)
index.html        Halaman game; undangan/index.html halaman scroll
api/              Fungsi serverless ucapan & RSVP, skema, validasi
src/
  data/           weddingInfo.ts (tipe + pembaca JSON), ngobrol.ts, seedWishes.ts, photoFrames.ts
  game/           Engine canvas tanpa framework: peta, kamera, karakter, pathfinding A*
  components/     UI React: amplop, pilih karakter, HUD, modal
  services/       Preload asset, audio, ucapan, kalender
  undangan/       Script, style, dan gambar halaman /undangan/ (TypeScript biasa, tanpa React)
public/assets/    Peta, karakter, musik, SVG, sticker, gambar preview
scripts/          Pengecekan otomatis yang dijalankan npm run check
```

### Catatan teknis

- **Tanpa game framework.** Engine-nya satu loop `requestAnimationFrame` di atas canvas 2D: satu `drawImage` untuk peta, karakter diurutkan berdasarkan y, dan partikel sederhana.
- **Data dari JSON.** `vite.config.ts` memilih `wedding.local.json` atau `wedding.json` lewat alias `@wedding`, dan mengisi token `{{...}}` di HTML/SVG saat build. TypeScript hanya mengecek file contoh, jadi `scripts/check-config.mjs` yang memvalidasi file yang benar-benar dipakai.
- **Postgres di belakang satu fungsi.** Validasi, daftar sticker, dan rate limit ada di server (`api/_store.ts`). `localStorage` hanya jaring pengaman agar ucapan tamu tidak hilang saat sinyal putus; ucapan yang gagal terkirim dikirim ulang otomatis.
- **SVG yang berisi teks harus di-inline**, bukan `<img src>`, karena font `@import` di dalamnya tidak bisa dimuat sebagai gambar.
- **Tiga pria dan dua wanita** berjalan di taman. `src/game/roster.ts` satu-satunya tempat yang mengaturnya.
- **iOS Safari:** overlay mengambil posisi dari `visualViewport`, dan volume musik tidak bisa diatur lewat JS, jadi fade di-*bake* ke file audionya.
