# Partnership TEN: Monitoring MoU & Kontrak

Mencatat MoU/kontrak dan menunjukkan mana yang akan habis atau melewati batas notice, supaya admin bisa segera mengurusnya.
Stack: React (Vite) + Node.js (Express) + SQLite bawaan Node 24 (`node:sqlite`, tanpa dependensi native).

## Menjalankan

Butuh Node.js 24 atau lebih baru.

```bash
npm install
npm --prefix client install
npm run build        # build tampilan React
npm run seed         # opsional: 10 kontrak contoh FIKTIF
npm start            # http://127.0.0.1:3001
```

Saat pertama dijalankan, akun admin dibuat dan **kata sandi acak ditampilkan sekali** di terminal. Tidak ada kata sandi bawaan.
Untuk menentukan sendiri: `ADMIN_EMAIL` dan `ADMIN_PASSWORD` (hanya dipakai saat belum ada pengguna).

Mode pengembangan: jalankan `npm run server` dan `npm run client` di dua terminal, lalu buka http://localhost:5173.

## Pengaturan (environment)

| Variabel | Fungsi |
|---|---|
| `PORT`, `HOST` | Bawaan `3001`, `127.0.0.1` |
| `DB_PATH` | Bawaan `data/simou.db` |
| `SESSION_SECRET` | **Wajib** bila `NODE_ENV=production` (juga mengaktifkan cookie `secure`, butuh HTTPS) |

## Aturan yang diterapkan

Logika ada di satu modul teruji: [server/logika.js](server/logika.js).
- Sisa hari, batas notice, dan tingkat perhatian (hijau >180, kuning 91-180, oranye 1-90, merah ≤0) dihitung dari tanggal (zona Asia/Jakarta), tidak disimpan.
- Status berubah hanya lewat tabel transisi, dan "Aktif" mensyaratkan tautan dokumen final + data lengkap.
- Job otomatis (saat start dan tiap jam) mengubah kontrak habis menjadi `berakhir`. Kontrak auto-renew **tidak**, tetapi ditandai "Konfirmasi auto-renew".
- Perpanjangan menambah `siklus_perpanjangan`, riwayat tanggal lama tetap tersimpan.
- Tanpa hapus permanen (soft delete), `audit_log` dan `riwayat_status` hanya bisa ditambah (dijaga trigger database).

## Belum ada (di luar permintaan awal, lihat BREAKDOWN.md)

Peran selain admin, persetujuan berjenjang Legal/Finance/Direksi, nilai kontrak dan pembayaran, unggah file, reminder email, impor/ekspor, MFA.

## Tes

```bash
npm test
```
