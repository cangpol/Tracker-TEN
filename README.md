# Partnership TEN: Monitoring MoU & Kontrak

Mencatat MoU/kontrak dan menunjukkan mana yang akan habis atau melewati batas notice, supaya bisa segera diurus.
Stack: React (Vite) + Node.js (Express) + **PostgreSQL**. Siap di-deploy ke **Vercel**.

## Deploy ke Vercel

1. Siapkan PostgreSQL. Disarankan yang menyediakan URL **pooled** (Neon, Supabase). Salin connection string-nya.
2. Impor repositori ke Vercel. Pengaturan build sudah ada di [vercel.json](vercel.json) (frontend ke `client/dist`, API di `api/index.js`, dua cron).
3. Isi Environment Variables di Project Settings (contoh lengkap: [.env.example](.env.example)):

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | Connection string PostgreSQL (pooled) |
| `SESSION_SECRET` | ya | String acak panjang (`openssl rand -hex 32`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | ya, sekali | Membuat Admin Sistem pertama bila belum ada. Sandi **wajib diganti** saat login pertama |
| `CRON_SECRET` | ya | String acak. Vercel mengirimnya sebagai Bearer token ke `/api/cron/*` |
| `SMTP_URL`, `MAIL_FROM`, `APP_URL` | tidak | Tanpa ini, pengingat hanya masuk ke notifikasi dalam aplikasi |
| `DEMO_MODE` | tidak | `1` = tampilkan akun demo satu klik dan isi data fiktif. **Jangan aktifkan di produksi** |

4. Deploy. Skema dibuat otomatis oleh migrasi saat instance pertama berjalan (aman bila banyak instance bersamaan).

Cron (zona UTC, setara WIB): `30 17 * * *` mengubah kontrak yang habis menjadi *berakhir* (00:30 WIB); `0 0 * * *` menjalankan pengingat (07:00 WIB). Paket Hobby Vercel membatasi cron sekali per hari, cukup untuk keduanya.

> Untuk demo publik, sebaiknya pakai proyek dan database **terpisah** dari produksi. Data demo dipakai bersama semua pengunjung.

## Menjalankan lokal

Butuh Node.js 22+ dan sebuah PostgreSQL.

```bash
docker run -d --name ten-pg -e POSTGRES_PASSWORD=ganti_ini -e POSTGRES_DB=partnership_ten -p 127.0.0.1:5432:5432 postgres:16-alpine
cp .env.example .env        # isi DATABASE_URL, SESSION_SECRET
npm install && npm --prefix client install
npm run build
DEMO_MODE=1 npm start       # http://127.0.0.1:3001, dengan akun demo
```

`npm run seed` mengisi data demo ke database di `DATABASE_URL` (idempoten). Mode pengembangan: `npm run server` dan `npm run client`, buka http://localhost:5173.

## Tes

Tes berjalan pada PostgreSQL asli. Tiap berkas tes membuat skema sementara sendiri dan menghapusnya setelah selesai.

```bash
# TEST_DATABASE_URL = database KOSONG khusus tes. Jangan arahkan ke produksi.
TEST_DATABASE_URL=postgresql://postgres:ganti_ini@127.0.0.1:5432/partnership_ten_uji npm test
```

## Peran dan hak akses

Aturan di satu modul: [server/akses.js](server/akses.js). Server yang memutuskan; tampilan hanya mengikuti.

| Peran | Ringkasan |
|---|---|
| Super Admin (Admin Sistem) | Pengguna, peran, divisi, audit log keamanan, kesehatan sistem. **Tidak** menjangkau data kontrak |
| Legal | Semua kontrak, nilai, perpanjangan, tahap Legal, aturan reminder dan ambang, audit log kontrak |
| PIC Divisi | Kontrak divisinya sendiri (sebelum Menunggu TTD), dokumen, tanpa nilai |
| Finance | Baca, lihat nilai, tahap Finance, dokumen final/adendum kontrak bernilai |
| Direksi | Baca, lihat nilai, tahap Direksi, putuskan kontrak |
| Auditor (Viewer) | Baca saja, tanpa nilai dan dokumen |

Aturan penting: penyetuju tidak boleh sama dengan pembuat kontrak; peran Admin Sistem, Legal, Finance, Direksi butuh persetujuan Admin Sistem lain; kolom nilai disaring di server; akun nonaktif langsung kehilangan sesi.

## Aturan bisnis yang diterapkan

Logika di [server/logika.js](server/logika.js) (teruji di nilai batas).
- Sisa hari, batas notice, tingkat perhatian (hijau >180, kuning 91–180, oranye 1–90, merah ≤0), zona Asia/Jakarta.
- Status hanya lewat tabel transisi. Ajukan ke Legal butuh dokumen draft; **Aktif butuh dokumen `final_ttd`** dan data lengkap.
- Routing persetujuan: nilai > 0 → Finance; risiko tinggi atau nilai ≥ ambang (pengaturan, 0 = nonaktif) → Direksi.
- Pengingat H-120/60/30/7 dari tanggal berakhir dan batas notice, penerima naik PIC → Legal → Direksi. Idempoten, catch-up hanya sekali, direset oleh perpanjangan. Email berupa ringkasan harian satu per penerima, tanpa nilai.
- Kontrak auto-renew tidak otomatis berakhir; riwayat tanggal lama tetap tersimpan; tidak ada hapus permanen.

## Belum ada

MFA/SSO, unggah file langsung (dokumen dikelola sebagai tautan Drive/SharePoint), impor CSV/XLSX data awal, jadwal pembayaran dan milestone, WhatsApp, ekspor Excel/PDF (baru CSV), syarat dokumen adendum saat perpanjangan, pencarian teks penuh di SQL (saat ini disaring di memori, cukup untuk ≤ 2.000 kontrak).
