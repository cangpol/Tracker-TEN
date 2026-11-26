# RENCANA_PERBAIKAN_SOP.md — Rencana Perbaikan Partnership TEN Sesuai SOP

Tujuan: menjadikan Partnership TEN tracker progres dokumen kerja sama dari **usulan unit sampai tanda tangan dan arsip**, sesuai SOP Partnership dan Formulir Usulan Kerja Sama, tanpa merusak modul pemantauan masa berlaku yang sudah berjalan.

Aturan rinci: [`ATURAN_ALUR_SOP.md`](ATURAN_ALUR_SOP.md). Prompt kerja: [`PROMPT_PERBAIKAN_SOP.md`](PROMPT_PERBAIKAN_SOP.md).

Status dokumen: **rencana**. Belum ada perubahan program.

---

## 1. Kondisi saat ini (ringkas)

| Aspek | Kondisi kode sekarang | Rujukan |
|---|---|---|
| Titik awal | `draft` kontrak oleh PIC, wajib sudah punya dokumen draft | `server/logika.js` `cekTransisi` |
| Urutan persetujuan | Legal → Finance (bila bernilai) → Direksi (bila risiko tinggi/nilai ≥ ambang) | `server/logika.js` `tujuanSetelahLegal` |
| Peran | admin_sistem, legal, pic, finance, direksi, viewer | `server/akses.js` |
| Penugasan | Tidak ada; notifikasi ke semua pengguna satu peran | `server/kontrak.js` `EFEK`, `server/notifikasi.js` |
| SLA | Tidak ada; hanya "menunggu N hari" di panel Finance | `server/kontrak.js` `panelFinance` |
| Reminder | Hanya masa berlaku dan notice kontrak | `server/jobs.js` |
| Penolakan | Tidak ada status ditolak | `server/logika.js` `TRANSISI` |
| Jenis permintaan | Tidak ada; perpanjangan = ganti tanggal oleh Legal | `server/kontrak.js` `/perpanjangan` |
| Data usulan | Hanya judul, ruang lingkup, counterparty (nama saja), nilai, tanggal | `server/db.js` migrasi 1 |
| Kekuatan | Tabel transisi di server, riwayat/persetujuan/audit hanya INSERT, four-eyes, isolasi divisi, reminder bertingkat, tes di PostgreSQL asli | — |

Kecocokan dengan SOP: dari 14 langkah, 2 cocok, 5 sebagian, 6 belum ada, 1 bertentangan.

---

## 2. Prinsip pelaksanaan

1. **Satu tahap = satu cabang = satu PR**, berurutan. Tiap tahap lulus tes sebelum tahap berikutnya.
2. **Pemantauan pasca-TTD tidak boleh rusak.** Tes `logika.test.js`, `reminder.test.js` yang ada harus tetap lulus kecuali butir yang memang diganti aturan baru, dengan alasan tertulis.
3. **Migrasi hanya ditambah**, tidak mengubah migrasi lama.
4. **Butir [TERBUKA] diputuskan dulu** (tahap S0) sebelum tahap yang bergantung padanya dikerjakan.
5. Data contoh dan tes memakai nama fiktif.

---

## 3. Tahapan

| Tahap | Isi | Bergantung pada | Butir SOP yang ditutup | Perkiraan ukuran |
|---|---|---|---|---|
| **S0** | Keputusan [TERBUKA] dan dokumen dasar | — | — | Tanpa kode |
| **S1** | Mesin SLA hari kerja + hari libur + antrean "menunggu saya" (status lama) | S0 butir hari kerja | P3 (sebagian), target waktu | Kecil–sedang |
| **S2** | Peran `partnership`, `atasan_unit`, flag `kepala`, `atasan_id`, tabel `penugasan` | S0 | Peran SOP bagian 2 | Sedang |
| **S3** | Model data: `usulan`, perluasan `counterparty`, `jenis_permintaan`, `kontrak_induk_id`, nomor registrasi, kategori dokumen baru, jenis MoA/Addendum, `siklus_persetujuan` | S2 | Formulir A–J, P6 | Sedang–besar |
| **S4** | Mesin status baru T01–T38, migrasi status lama, hapus syarat draf, status `ditolak`, kunci kolom pokok, jalur inventaris | S3 | A–F, 1–8, P1, P2, P7 | Besar |
| **S5** | Layar: formulir usulan bertahap, seleksi, kajian, brief Legal, garis waktu tahap, tombol aksi | S4 | Formulir, tampilan | Besar |
| **S6** | Job eskalasi SLA tiga tingkat + ringkasan email | S1, S2, S4 | P3 | Sedang |
| **S7** | Berkas anak: addendum, perpanjangan, pengakhiran; reminder "segera perpanjang" membuka usulan perpanjangan | S4, S5 | SOP ruang lingkup b, tahap 1 | Sedang |
| **S8** | Dashboard dan laporan: corong usulan, kepatuhan SLA per kelompok, ekspor dengan nomor registrasi | S4, S6 | Pengendalian, pelaporan | Sedang |
| **S9** | Tinjauan keamanan, pembaruan README dan dokumen, uji regresi penuh | Semua | — | Kecil |

Urutan alternatif bila ingin hasil cepat terlihat: S0 → S1 → S2 → (pakai di alur lama) → S3 → S4 dan seterusnya. S1 dibuat berbasis konfigurasi per status sehingga tetap berlaku setelah S4.

---

## 4. Rincian per tahap

### S0. Keputusan dan dokumen dasar

- Jawab butir [TERBUKA] di bagian 6 dokumen ini. Catat jawabannya langsung di `ATURAN_ALUR_SOP.md` (ganti tanda [TERBUKA] dengan keputusan).
- `BREAKDOWN.md` dan `SECURITY.md` dirujuk `CLAUDE.md` dan `ATURAN.md` tetapi tidak ada di repositori. Tambahkan, atau ubah rujukan agar Claude tidak mencari berkas yang tidak ada.
- Dapatkan templat resmi Legal Brief Request.
- Selesai bila: tidak ada [TERBUKA] yang menghalangi S1–S4.

### S1. Mesin SLA

- `server/logika.js`: fungsi hari kerja (`tambahHariKerja`, `selisihHariKerja`) dan `hitungSla(riwayat, kelompok, target, libur, hari)`.
- Migrasi: tabel `hari_libur`, kunci `pengaturan` untuk target SLA per kelompok dan pemetaan status → kelompok.
- `server/kontrak.js`: bidang turunan SLA di daftar/detail; panel "menunggu saya" berurut keterlambatan.
- `client`: chip status SLA di daftar dan detail.
- Tes: batas Jumat/Senin, libur, tengah malam WIB, reset setelah pengembalian.
- Selesai bila: setiap kontrak dalam proses menampilkan tenggat dan status SLA.

### S2. Peran dan penugasan

- `server/akses.js`: peran baru, `ISTIMEWA`, `IZIN`, `terbatasDivisi` untuk `atasan_unit`.
- Migrasi: CHECK peran, kolom `pengguna.kepala`, `pengguna.atasan_id`, tabel `penugasan` (trigger hanya INSERT).
- `server/pengguna.js` dan `client/src/pages/Pengguna.jsx`: kelola peran baru dan atasan.
- `server/notifikasi.js`: penerima = penugasan bila ada, peran bila belum.
- Akun demo fiktif untuk peran baru (`server/demo.js`).
- Tes: four-eyes peran istimewa, isolasi divisi `atasan_unit`.

### S3. Model data usulan

- Migrasi: tabel `usulan`, `legal_brief`; kolom `kontrak.nomor_registrasi`, `jenis_permintaan`, `kontrak_induk_id`, `siklus_persetujuan`, `jalur_lama`, `lokasi_arsip_asli`, `tanggal_distribusi_salinan`, `pengusul_id`; kolom `counterparty` baru; `persetujuan.siklus` dan tahap/keputusan baru; kategori dokumen dan jenis dokumen baru.
- Penomoran registrasi aman bersamaan (tabel penghitung per tahun + kunci baris).
- Validasi kolom wajib Formulir di server.
- Tes: penomoran bersamaan, validasi wajib, visibilitas `estimasi_nilai`.

### S4. Mesin status baru

- `server/logika.js`: `STATUS`, `TRANSISI`, `cekTransisi` sesuai T01–T38; hapus syarat draf; routing `review_finance` di tahap kajian; persetujuan pimpinan selalu wajib.
- `server/akses.js`: `OLEH` sesuai kolom Pelaku; `tolakPelaku` four-eyes di semua titik keputusan; kunci kolom pokok setelah T13.
- `server/kontrak.js`: `EFEK` notifikasi baru, pencatatan `persetujuan` per tahap dan siklus, efek T17/T23 menaikkan siklus.
- Migrasi data status lama (ATURAN_ALUR_SOP bagian 13) dan jalur inventaris.
- Tes: seluruh tabel transisi per peran, migrasi, regresi pemantauan.

### S5. Layar

- `client/src/pages/Form.jsx`: form bertahap A–H, simpan draf, ringkasan sebelum kirim.
- `client/src/pages/Detail.jsx`: tab Usulan (A–J), garis waktu tahap SOP, pemegang berkas, SLA, tab Brief Legal, tombol aksi sesuai `transisiTersedia`.
- `client/src/pages/Dashboard.jsx`: antrean per peran.
- Peringatan P4 dan P5.
- Tes: endpoint yang dipakai layar; uji manual alur penuh dengan akun demo.

### S6. Eskalasi

- `server/jobs.js`: `jalankanEskalasiSla` (idempoten, tabel `eskalasi_sla`), dipanggil dari cron pengingat 07:00 WIB yang sudah ada (`vercel.json` tidak perlu cron tambahan).
- Gabung ke ringkasan email harian.
- Tes: tidak ganda, tingkat naik, penerima benar.

### S7. Berkas anak

- Endpoint "ajukan addendum/perpanjangan/pengakhiran" dari detail kontrak aktif membuat usulan anak terisi dari induk.
- T32 menerapkan efek ke induk dalam satu transaksi.
- Tombol "Ajukan perpanjangan" di tabel prioritas dashboard membuka usulan anak.
- Endpoint perpanjangan langsung dibatasi untuk konfirmasi auto-renew.
- Tes: tiga jenis efek, pembatalan anak mengembalikan induk.

### S8. Dashboard dan laporan

- Corong usulan per periode, kepatuhan SLA per kelompok dan per orang, daftar terlambat.
- Ekspor CSV memuat nomor registrasi, tahap, pemegang berkas, status SLA. Kolom nilai tetap mengikuti hak akses.

### S9. Penutup

- Prompt tinjauan keamanan (`PROMPT_PERBAIKAN_SOP.md` bagian E) atas seluruh perubahan.
- Perbarui `README.md` (peran, alur, "Belum ada"), `CLAUDE.md` bagian 5, dan `ATURAN.md` bagian 6.
- Laporan kesesuaian SOP akhir (prompt bagian F).

---

## 5. Matriks keterlacakan SOP → tahap

| Butir SOP/Formulir | Aturan | Tahap |
|---|---|---|
| A. Penjajakan, NDA | Bagian 8 (status NDA), 14 butir 7 | S3, S5 |
| B. Formulir A–H + atasan | T01–T04, bagian 8 | S2, S3, S4, S5 |
| C. Seleksi + nomor registrasi | T05–T07, bagian 3 | S3, S4 |
| D. Kajian + Finance | T08–T12 | S4 |
| E. Persetujuan pimpinan | T13–T15, bagian 10 | S4 |
| F. Konfirmasi mitra | T16–T18 | S4, S5 |
| 1–2. Legal Brief | T19, bagian 9 | S3, S4, S5 |
| 3. Cek kelengkapan | T20–T21 | S4 |
| 4. Analisis hukum | T22–T23 | S4 |
| 5. Susun draf | T24–T27 | S4 |
| 6–7. Konfirmasi dan finalisasi | T28–T30 | S4 |
| 8. TTD, distribusi, arsip | T31–T33, bagian 12 | S4, S5 |
| Target waktu per tahap | Bagian 11 | S1, S6 |
| P1 Pengembalian | Kolom Alasan, bagian 11 butir 4 | S1, S4 |
| P2 Penolakan | T07, T14 | S4 |
| P3 Eskalasi | Bagian 11 butir 6 | S6 |
| P4 Larangan | Bagian 14 butir 6 | S5 |
| P5 Kerahasiaan | Bagian 14 butir 7 | S5 |
| P6 Nomor registrasi sama | Bagian 3 | S3 |
| P7 Perubahan setelah persetujuan | Bagian 10 | S4 |
| Ruang lingkup b (addendum, perpanjangan, pengakhiran) | Bagian 4 | S7 |

---

## 6. Keputusan yang dibutuhkan (S0)

| # | Pertanyaan | Usulan bawaan | Menghalangi |
|---|---|---|---|
| K1 | Target dihitung hari kerja atau kalender? | Hari kerja + daftar libur | S1 |
| K2 | Target untuk tahap tanpa angka di SOP (atasan, konfirmasi mitra, negosiasi, TTD)? | Tidak dipantau sampai diisi | S1, S6 |
| K3 | Hari keterlambatan untuk eskalasi tingkat 2 dan 3? | 1 dan 3 hari kerja | S6 |
| K4 | Matriks kewenangan pimpinan per nilai? | Semua Direksi boleh menyetujui | S4 |
| K5 | Siapa boleh melihat estimasi nilai di usulan? | Pembuat, atasan, Partnership, Finance, Legal, Direksi | S3 |
| K6 | Format nomor registrasi? | `REG/PTN/{YYYY}/{NNNN}` | S3 |
| K7 | Adopsi masukan alur: tahap 5a negosiasi mitra, analisis Legal dapat memicu persetujuan ulang, konfirmasi Unit dan Finance di tahap 6? | Diadopsi, menunggu SOP revisi | S4 |
| K8 | Pemetaan status kontrak lama yang sedang berjalan? | Tabel di ATURAN_ALUR_SOP bagian 13 | S4 |
| K9 | Apakah auto-renew juga wajib lewat alur penuh? | Tidak, cukup konfirmasi Legal | S7 |
| K10 | Siapa menunjuk unit pemilik untuk penawaran dari mitra? | Partnership | S4 |
| K11 | Struktur atasan dikelola di aplikasi (`atasan_id`) atau cukup per peran? | `atasan_id` opsional | S2 |
| K12 | Templat resmi Legal Brief Request | Kolom dari uraian SOP tahap 2 | S3 |

---

## 7. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Migrasi status kontrak yang sedang berjalan salah petakan | Berkas macet atau melompati persetujuan | Pemetaan dikonfirmasi Legal, `jalur_lama`, dry run di salinan database |
| Alur menjadi panjang (16 status proses) | Pengguna menganggap lambat | Garis waktu jelas, antrean "menunggu saya", SLA tampil |
| SOP direvisi setelah kode dibangun | Kerja ulang | Putuskan K7 lebih dulu; tabel transisi di satu modul |
| Data pribadi PIC mitra | Kebocoran | Ikuti SECURITY.md, tidak di log/email, batasi peran |
| Vercel Hobby hanya cron harian | Eskalasi tidak real-time | Cukup untuk target dalam hari kerja; jalankan bersama job 07:00 |

---

## 8. Laporan: yang masih perlu diperbaiki setelah penyesuaian

Setelah aturan dan rencana ini, hal berikut **belum** terselesaikan oleh dokumen dan masih perlu ditindaklanjuti:

1. **12 keputusan K1–K12** belum dijawab. Paling mendesak: K1 (hari kerja), K4 (matriks kewenangan), K5 (visibilitas nilai), K7 (adopsi masukan alur), K8 (pemetaan data lama).
2. **Templat Legal Brief Request** tidak ada di dokumen yang diterima. Kolom brief di aturan masih turunan dari uraian SOP.
3. **Bagan alur** "Alur Awal Kerja Sama" dan "Alur Koordinasi Partnership–Legal" yang dirujuk SOP tidak terbaca dari PDF. Perlu dicocokkan manual dengan tabel transisi.
4. **SOP sendiri perlu revisi** agar aplikasi dan SOP tidak berbeda: tahap negosiasi mitra, Finance di tahap 6, target tahap 8, tahap serah terima ke Tracker, definisi "perubahan pokok", hari kerja, dan jalur cepat dokumen standar. Juga salah ketik: "Operasioal", "pintuk", "analisin".
5. **Kontradiksi dengan aturan lama yang harus disetujui pemilik sistem:** `CLAUDE.md` bagian 5 (alur status), `CLAUDE.md` aturan 7 dan 10 (ambang Direksi dan visibilitas nilai), `ATURAN.md` bagian 6 butir 1 dan 6 (tabel transisi, four-eyes).
6. **Berkas rujukan hilang:** `BREAKDOWN.md` dan `SECURITY.md` dirujuk tetapi tidak ada di repositori.
7. **Di luar cakupan SOP dan rencana ini:** unggah file langsung, impor data awal, SSO/MFA, ekspor Excel/PDF, WhatsApp. Daftar "Belum ada" di `README.md` tetap berlaku.
8. **Jalur cepat** untuk dokumen standar berisiko rendah (misalnya NDA templat) belum diatur. Tanpa ini, setiap NDA melewati 16 status.
