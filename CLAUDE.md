# CLAUDE.md — Partnership TEN (Sistem Informasi Monitoring MoU & Kontrak)

Konteks proyek untuk Claude. Baca file ini sebelum mengerjakan apa pun di repositori ini.

## 1. Ringkasan Proyek

- **Nama aplikasi:** Partnership TEN (sebelumnya SiMoU)
- **Pemilik:** PT Triputra Edukasi Nusantara (perusahaan, bukan kampus)
- **Tujuan:** melacak MoU dan kontrak: progres status, lokasi dokumen, masa berlaku, dan kebutuhan perpanjangan, dengan dashboard ringkasan.
- **Masalah yang diselesaikan:** status kontrak tidak terpantau, lokasi dokumen tidak jelas, masa berlaku atau batas pemberitahuan terlewat.
- **Bahasa:** antarmuka dan dokumentasi dalam Bahasa Indonesia. Nama tabel dan kolom database memakai Bahasa Indonesia snake_case seperti di bawah.

## Dokumen Terkait (baca sebelum bekerja)

| File | Isi |
|---|---|
| `BREAKDOWN.md` | Spesifikasi detail: matriks hak akses, tabel transisi status, model data, API, layar, metrik, impor, pengujian |
| `ATURAN.md` | Aturan pengembangan, aturan bisnis yang tidak boleh dilanggar, Definition of Done |
| `SECURITY.md` | Keamanan: autentikasi, otorisasi, unggahan, kripto, audit log, backup, penggunaan AI, checklist peluncuran |
| `PROMPT.md` | Prompt kerja per tahap dan prompt tinjauan keamanan |
| `docs/sop/ATURAN_ALUR_SOP.md` | Aturan alur sesuai SOP Partnership (usulan sampai TTD): peran, status, tabel transisi, SLA, data usulan. Menggantikan bagian 5 di bawah |
| `docs/sop/RENCANA_PERBAIKAN_SOP.md` | Rencana perbaikan bertahap S0–S9 dan keputusan yang dibutuhkan |
| `docs/sop/PROMPT_PERBAIKAN_SOP.md` | Prompt kerja per tahap penyesuaian SOP |

Urutan prioritas bila ada perbedaan: `SECURITY.md` > `BREAKDOWN.md` > `ATURAN.md` > `CLAUDE.md`.

## 2. Istilah

| Istilah | Arti |
|---|---|
| Kontrak | Semua dokumen perjanjian: MoU, PKS, NDA, SPK, kontrak vendor, kontrak klien |
| Counterparty | Pihak lawan kontrak: sekolah, institusi, vendor, klien, instansi pemerintah |
| Divisi | Unit internal pemilik kontrak (BD, Operasional, Akademik, dan lain-lain) |
| PIC | Penanggung jawab kontrak di divisi |
| Notice period | Batas waktu pemberitahuan tidak memperpanjang atau memutus kontrak |

## 3. Peran Pengguna

| Peran | Hak akses |
|---|---|
| Admin / Legal | Kelola semua data kontrak, master data bisnis, aturan reminder |
| Admin Sistem (TI) | Kelola pengguna, peran, konfigurasi teknis. Tidak melihat isi kontrak dan nilai |
| PIC Divisi | Input dan ubah kontrak divisinya sendiri, unggah dokumen |
| Finance | Lihat nilai kontrak dan jadwal pembayaran |
| Direksi | Dashboard, laporan, dan persetujuan |
| Viewer / Auditor | Baca saja |

## 4. Modul

1. **Data kontrak:** CRUD, pencarian, filter, riwayat perubahan.
2. **Tracking progres:** perubahan status tercatat (tanggal, pelaku, catatan).
3. **Repositori dokumen:** file atau link (draft, final bertanda tangan, adendum, laporan), kategori, versi.
4. **Masa berlaku dan perpanjangan:** hitung sisa hari, batas notice, alur perpanjangan.
5. **Persetujuan berjenjang:** Legal → Finance → Direksi.
6. **Notifikasi:** email (tahap lanjut: WhatsApp/Telegram), notifikasi dalam aplikasi.
7. **Dashboard dan laporan:** ringkasan visual, ekspor Excel/PDF.
8. **Master data:** counterparty, divisi, jenis dokumen, aturan reminder.
9. **Pengguna dan keamanan:** login, RBAC, audit log.

## 5. Alur Status

> **Diganti oleh `docs/sop/ATURAN_ALUR_SOP.md`** untuk alur dari usulan sampai tanda tangan. Bagan di bawah adalah alur lama yang masih berjalan di kode sampai tahap S4 rencana perbaikan selesai.

```
Draft → Review Legal → Review Finance (jika ada nilai) → Persetujuan Direksi → Menunggu TTD → Aktif
                                                                                              │
                                                       ┌──────────────────────────────────────┤
                                                       ▼                                      ▼
                                         Mendekati Berakhir ──► Negosiasi Perpanjangan ──► Diperpanjang
                                                       │
                                                       ▼
                                          Berakhir / Diputus ──► Arsip
```

- "Mendekati Berakhir" dan "Berakhir" **dihitung otomatis dari tanggal**, bukan diisi manual.
- Status lain diubah manual oleh PIC atau Admin dan selalu dicatat di `riwayat_status`.

## 6. Model Data

**counterparty**
`id, nama, jenis (sekolah/institusi/vendor/klien/pemerintah), npwp, alamat, kontak_nama, kontak_email, kontak_telepon`

**kontrak** (tabel inti)
`id, nomor_kontrak, judul, jenis_dokumen (MoU/PKS/NDA/SPK/kontrak_vendor), ruang_lingkup, counterparty_id, divisi_id, pic_user_id, penandatangan_internal, penandatangan_pihak_lain, tanggal_ttd, tanggal_mulai, tanggal_berakhir, perpanjangan_otomatis, masa_pemberitahuan_hari, status, nilai_kontrak, mata_uang, skema_pembayaran, jenis_kontrak (pendapatan/pengeluaran/non_finansial), tingkat_risiko, klausul_penting, e_meterai, catatan, diarsipkan_pada`

**riwayat_status**
`id, kontrak_id, status_lama, status_baru, tanggal, diubah_oleh, catatan`

**dokumen**
`id, kontrak_id, kategori (draft/final_ttd/adendum/laporan), nama_file, lokasi (path/URL), versi, diunggah_oleh, tanggal_unggah`

**perpanjangan**
`id, kontrak_id, tanggal_pengajuan, tanggal_berakhir_baru, status, keputusan, catatan`

**persetujuan**
`id, kontrak_id, tahap (legal/finance/direksi), pemberi_persetujuan, keputusan, tanggal, catatan`

**jadwal_pembayaran** (opsional)
`id, kontrak_id, termin, jumlah, tanggal_jatuh_tempo, status_bayar`

**kewajiban_milestone** (opsional)
`id, kontrak_id, deskripsi, tanggal_target, status, penanggung_jawab`

**divisi:** `id, nama_divisi, kode`
**pengguna:** `id, nama, email, divisi_id, peran`
**aturan_reminder:** `id, hari_sebelum, acuan (berakhir/notice), penerima (PIC/Legal/Direksi), aktif`
**audit_log:** `id, user_id, aksi, tabel, record_id, waktu`

**Relasi:** satu counterparty punya banyak kontrak. Satu kontrak punya banyak dokumen, riwayat_status, perpanjangan, persetujuan, jadwal_pembayaran, dan kewajiban_milestone.

## 7. Aturan Bisnis (wajib dipatuhi di kode)

1. `sisa_hari = tanggal_berakhir − hari ini`.
2. `tanggal_batas_notice = tanggal_berakhir − masa_pemberitahuan_hari`. Reminder dihitung dari tanggal ini **dan** dari tanggal berakhir.
3. Klasifikasi otomatis berdasarkan sisa hari:
   - \> 180 hari: Aktif (hijau)
   - 91–180 hari: Perlu perhatian (kuning)
   - 1–90 hari: Segera perpanjang (oranye)
   - ≤ 0 hari: Berakhir (merah)
4. Kontrak dengan `perpanjangan_otomatis = ya` diberi penanda khusus dan reminder lebih awal.
5. Reminder bertingkat, bawaan H-120, H-60, H-30, H-7, bisa diubah di `aturan_reminder`. Penerima naik dari PIC ke Legal, lalu Direksi.
6. Status tidak boleh "Aktif" bila dokumen final bertanda tangan (`kategori = final_ttd`) belum diunggah.
7. Kontrak di atas ambang nilai tertentu wajib persetujuan Direksi (ambang dikonfigurasi, jangan di-hardcode).
8. Saat perpanjangan disetujui, `tanggal_berakhir` diperbarui dan riwayat lama tetap tersimpan.
9. Tidak ada hapus permanen: gunakan soft delete (`diarsipkan_pada`).
10. Kolom nilai kontrak dan jadwal pembayaran hanya terlihat oleh Admin/Legal, Finance, dan Direksi.

## 8. Dashboard

**Kartu angka:** total kontrak, aktif, segera berakhir (≤ 90 hari), berakhir, dalam proses persetujuan, total nilai kontrak aktif.

**Visual:**
- Komposisi status (donut)
- Kontrak berakhir per bulan, 12 bulan ke depan (bar)
- Jumlah dan nilai kontrak per divisi
- Pendapatan vs pengeluaran
- Komposisi jenis counterparty
- Kontrak per tingkat risiko

**Tabel prioritas:** kontrak paling dekat berakhir atau batas notice-nya, dengan sisa hari, PIC, tombol "Buka dokumen" dan "Ajukan perpanjangan".

**Filter global:** tahun, divisi, jenis dokumen, status, counterparty.

## 9. Halaman Aplikasi

1. Login
2. Dashboard
3. Daftar kontrak (filter, ekspor)
4. Detail kontrak (tab: Info, Progres, Dokumen, Persetujuan, Perpanjangan, Pembayaran, Riwayat)
5. Form tambah/ubah kontrak
6. Daftar counterparty
7. Reminder dan notifikasi
8. Laporan
9. Pengaturan (pengguna, divisi, aturan reminder)

## 10. Pilihan Teknis

| Opsi | Cocok jika |
|---|---|
| Google Sheets + Apps Script / Excel + Power Automate | Puluhan kontrak, anggaran minim, hak akses sederhana |
| Low-code (AppSheet, Power Apps, Airtable) | Perlu peran pengguna dan form rapi tanpa membangun dari nol |
| Web custom (Laravel/Node + MySQL/PostgreSQL) | Ratusan kontrak, banyak pengguna, perlu integrasi (SSO, email, ERP) |

- Dokumen tetap di penyimpanan yang sudah dipakai (Google Drive / SharePoint). Database hanya menyimpan path atau link.
- Pendukung: penjadwal harian (cron) untuk hitung status dan kirim reminder, SMTP, backup terjadwal.
- **Keputusan stack belum final.** Tanyakan ke pengguna sebelum memilih.

## 11. Keamanan dan Kepatuhan

- RBAC sesuai peran di bagian 3. Idealnya terhubung ke SSO perusahaan.
- Akses dokumen dan kolom nilai dibatasi per peran.
- Audit log untuk setiap perubahan data dan pembukaan dokumen sensitif.
- Backup rutin dan uji pemulihan.
- Bila kontrak memuat data pribadi pihak ketiga, ikuti kebijakan pelindungan data perusahaan.

## 12. Tahapan Pembangunan

1. **Fase 1 (MVP):** data kontrak, tanggal berakhir, batas notice, status otomatis, link dokumen, dashboard dasar.
2. **Fase 2:** persetujuan berjenjang, upload dokumen, reminder email, peran pengguna.
3. **Fase 3:** nilai dan jadwal pembayaran, kewajiban/milestone, laporan manajemen, WhatsApp, SSO.
4. **Sejak awal:** inventarisasi dan pembersihan data kontrak yang sudah ada.

## 13. Pertanyaan Terbuka (tanyakan ke pengguna, jangan berasumsi)

- Jenis dokumen apa saja yang dilacak: hanya MoU, atau juga PKS, NDA, kontrak vendor?
- Counterparty utama siapa (sekolah, institusi, vendor, klien)?
- Apakah nilai kontrak perlu dicatat dan dibatasi aksesnya?
- Jumlah kontrak saat ini dan lokasi dokumen sekarang (Drive, SharePoint, fisik)?
- Siapa yang menginput: satu admin Legal atau tiap divisi?
- Stack teknis yang dipilih (sheet, low-code, atau web custom)?

## 14. Panduan Bekerja untuk Claude

- Jawab dan tulis dokumentasi dalam Bahasa Indonesia.
- Patuhi aturan bisnis di bagian 7. Jangan mengubahnya tanpa konfirmasi.
- Jangan menyimpan atau menampilkan data sensitif (nilai kontrak, klausul) di log atau contoh publik. Gunakan data contoh fiktif.
- Untuk data contoh dan prototipe, gunakan nama counterparty fiktif.
- Hasil akhir harus rapi dan profesional (dokumen terstruktur, laporan bersih).
- Bila ada keputusan yang belum jelas, tanyakan dulu sebelum membangun.
- Ikuti `ATURAN.md` dan `SECURITY.md`. Jangan melemahkan kontrol keamanan demi kecepatan atau agar tes lolos.
- Jangan pernah memakai data asli (nilai kontrak, klausul, dokumen, NPWP, kredensial) dalam prompt, contoh, seed, atau tes.
