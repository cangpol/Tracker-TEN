# PROMPT_PERBAIKAN_SOP.md — Prompt Kerja Penyesuaian Alur SOP

Prompt siap tempel untuk mengerjakan [`RENCANA_PERBAIKAN_SOP.md`](RENCANA_PERBAIKAN_SOP.md) bersama Claude di VS Code (ekstensi Claude Code). Aturan yang diikuti: [`ATURAN_ALUR_SOP.md`](ATURAN_ALUR_SOP.md).

---

## A. Cara pakai di VS Code

1. Buka folder repositori `Tracker-TEN` di VS Code, lalu buka panel Claude Code.
2. Buat cabang per tahap sebelum mulai, misalnya `git checkout -b sop/s1-sla`.
3. Tempel **Prompt Dasar** (bagian B) di awal setiap sesi baru.
4. Tempel prompt tahap (bagian C) **satu per sesi**. Tinjau rencana Claude sebelum menyetujui perubahan berkas.
5. Setelah tahap selesai: jalankan tes, tempel **Prompt Verifikasi Tahap** (bagian D), lalu **Prompt Tinjauan Keamanan** (bagian E).
6. Merge lewat PR, baru lanjut ke tahap berikutnya.
7. Tes butuh PostgreSQL kosong khusus tes:
   ```bash
   TEST_DATABASE_URL=postgresql://postgres:ganti_ini@127.0.0.1:5432/partnership_ten_uji npm test
   ```
8. Jangan menempel data asli (nilai kontrak, nama mitra sebenarnya, kontak, NPWP) ke prompt. Pakai data fiktif.

---

## B. Prompt Dasar (tempel di awal setiap sesi)

```text
Kamu membantu menyesuaikan aplikasi Partnership TEN dengan SOP Partnership "dari Usulan hingga Penandatanganan" dan Formulir Usulan Kerja Sama.

Baca dulu sebelum mengerjakan apa pun:
- CLAUDE.md dan ATURAN.md (konteks dan aturan pengembangan)
- docs/sop/ATURAN_ALUR_SOP.md (aturan alur baru; untuk alur status, peran alur, SLA, dan data usulan, berkas ini yang berlaku)
- docs/sop/RENCANA_PERBAIKAN_SOP.md (tahapan dan keputusan)
- Kode terkait: server/logika.js, server/akses.js, server/kontrak.js, server/db.js, server/jobs.js, server/notifikasi.js

Aturan kerja:
1. Jawab dan tulis dokumentasi dalam Bahasa Indonesia.
2. Kerjakan HANYA tahap yang saya minta. Jangan mengerjakan tahap lain sekaligus.
3. Butir bertanda [TERBUKA] belum diputuskan. Bila tugas bergantung padanya, berhenti dan tanya saya.
4. Status hanya berubah lewat tabel transisi di satu modul. Hak akses dan validasi di server.
5. Migrasi database hanya DITAMBAH di akhir daftar MIGRASI di server/db.js. Jangan mengubah migrasi lama.
6. Tabel riwayat_status, persetujuan, audit_log, penugasan hanya INSERT.
7. Tes yang ada jangan dihapus atau dilemahkan. Bila aturan baru memang mengganti perilaku lama, ubah tesnya dan tulis alasannya.
8. Data contoh, seed, dan tes memakai data fiktif.
9. Sebelum mengubah berkas, jelaskan rencanamu singkat (berkas yang disentuh, migrasi, tes) dan tunggu persetujuan saya.
10. Di akhir tugas laporkan: apa yang berubah, butir aturan (T.., bagian ..) yang dipenuhi, cara menguji, dampak keamanan, dan sisa pekerjaan.

Konfirmasi bahwa kamu sudah membaca berkas di atas, lalu sebutkan butir [TERBUKA] yang menghalangi tahap yang akan saya minta.
```

---

## C. Prompt per tahap

### S0. Keputusan dan dokumen dasar

```text
Kerjakan tahap S0 di docs/sop/RENCANA_PERBAIKAN_SOP.md. Jangan mengubah kode.

Tugas:
1. Tampilkan keputusan K1–K12 satu per satu dalam bentuk pertanyaan singkat dengan usulan bawaannya. Tunggu jawaban saya.
2. Setelah saya jawab, perbarui docs/sop/ATURAN_ALUR_SOP.md: ganti setiap tanda [TERBUKA] yang sudah diputuskan dengan keputusan dan tanggalnya. Biarkan yang belum diputuskan.
3. Periksa rujukan ke BREAKDOWN.md dan SECURITY.md di CLAUDE.md dan ATURAN.md. Berkas itu tidak ada di repositori. Usulkan dua pilihan: tambahkan berkasnya, atau ubah rujukan. Tunggu pilihan saya.
4. Laporkan tahap mana yang sekarang sudah bisa dikerjakan.
```

### S1. Mesin SLA hari kerja

```text
Kerjakan tahap S1 (Mesin SLA) sesuai docs/sop/ATURAN_ALUR_SOP.md bagian 11 butir 1–5.

Tugas:
1. Di server/logika.js tambahkan fungsi hari kerja (zona Asia/Jakarta, Senin–Jumat dikurangi hari libur) dan fungsi hitungSla yang menghasilkan masuk_kelompok_pada, tenggat_sla, hari_kerja_berjalan, sisa_hari_kerja, status_sla dari riwayat_status.
2. Migrasi baru: tabel hari_libur (tanggal unik, keterangan); kunci pengaturan untuk target per kelompok SLA dan pemetaan status → kelompok. Untuk status lama sekarang, petakan sementara: review_legal → analisis, review_finance → kajian_persetujuan, persetujuan_direksi → kajian_persetujuan, menunggu_ttd → ttd.
3. Endpoint kelola hari libur (peran legal; nanti partnership) dengan audit log.
4. Tambahkan bidang SLA turunan pada respons daftar dan detail kontrak, dan panel "menunggu saya" di dashboard berurut keterlambatan.
5. Tampilkan chip status SLA (warna + label) di Daftar dan Detail.
6. Tes unit nilai batas: Jumat → Senin, hari libur di tengah, tengah malam WIB, reset jam setelah pengembalian, perpindahan dalam kelompok yang sama tidak mereset.

Batasan: target dan pemetaan dibaca dari pengaturan, tidak di-hardcode. Jangan mengubah alur status pada tahap ini.
```

### S2. Peran dan penugasan

```text
Kerjakan tahap S2 sesuai docs/sop/ATURAN_ALUR_SOP.md bagian 2 dan 7.

Tugas:
1. Tambahkan peran partnership dan atasan_unit di server/akses.js (PERAN, LABEL_PERAN, ISTIMEWA, IZIN, RINGKAS_PERAN). atasan_unit dibatasi divisi seperti pic. partnership melihat semua divisi.
2. Migrasi baru: perluas CHECK peran, kolom pengguna.kepala (boolean) dan pengguna.atasan_id, tabel penugasan (kontrak_id, peran, pengguna_id, ditugaskan_oleh, waktu) dengan trigger hanya INSERT.
3. Endpoint tugaskan/pindahkan PIC Partnership dan PIC Legal (pemindahan oleh kepala, alasan wajib, audit log).
4. Ubah penerima notifikasi alur kerja: ke pengguna yang ditugaskan bila ada, ke peran bila belum.
5. Halaman Pengguna: kelola peran baru, kepala, atasan. Akun demo fiktif untuk peran baru di server/demo.js.
6. Tes: pemberian peran baru butuh persetujuan Admin Sistem kedua; isolasi divisi atasan_unit; penugasan tidak bisa diubah/dihapus; notifikasi ke orang yang ditugaskan.

Batasan: jangan mengubah tabel transisi pada tahap ini.
```

### S3. Model data usulan

```text
Kerjakan tahap S3 sesuai docs/sop/ATURAN_ALUR_SOP.md bagian 3, 4 (kolom saja), 8, 9, 10 butir 1–2, dan 12.

Tugas:
1. Migrasi baru: tabel usulan (kolom bagian 8), tabel legal_brief (bagian 9), kolom baru di kontrak (nomor_registrasi unik, jenis_permintaan, kontrak_induk_id, siklus_persetujuan, jalur_lama, lokasi_arsip_asli, tanggal_distribusi_salinan, pengusul_id), kolom baru counterparty, persetujuan.siklus serta tahap dan keputusan baru, kategori dokumen baru, jenis dokumen MoA dan Addendum. Gunakan CHECK untuk semua pilihan tetap.
2. Penomoran registrasi aman bersamaan: tabel penghitung per tahun dengan kunci baris di dalam transaksi. Format dari pengaturan.
3. Validasi kolom wajib Formulir di server (fungsi terpisah yang diuji), dipakai nanti oleh T01.
4. Penyaringan estimasi_nilai sesuai keputusan K5.
5. Endpoint baca/ubah usulan dan legal_brief dengan hak akses per peran dan status (bagian 8 butir 4).
6. Tes: penomoran 20 permintaan bersamaan tanpa duplikat, validasi wajib, visibilitas estimasi_nilai per peran, isolasi divisi.

Batasan: data pribadi PIC mitra tidak masuk log atau email. Jangan mengubah tabel transisi pada tahap ini.
```

### S4. Mesin status baru

```text
Kerjakan tahap S4 sesuai docs/sop/ATURAN_ALUR_SOP.md bagian 5, 6 (T01–T38), 10 butir 3–5, dan 13.

Sebelum menulis kode, tampilkan:
- daftar perubahan pada STATUS, TRANSISI, OLEH, EFEK, WAJIB_ALASAN;
- tes lama yang akan berubah perilakunya beserta alasannya;
- rencana migrasi data status lama.
Tunggu persetujuan saya.

Tugas:
1. server/logika.js: STATUS dan TRANSISI baru, cekTransisi dengan syarat server per baris tabel, transisiTersedia. Hapus syarat dokumen draft sebelum Legal. Persetujuan pimpinan selalu wajib sebelum brief_legal.
2. server/akses.js: OLEH sesuai kolom Pelaku; four-eyes di T03, T05, T11, T13, T20, T28; kunci kolom pokok setelah T13 kecuali lewat T17/T23.
3. server/kontrak.js: catat persetujuan per tahap dan siklus; T17/T23 menaikkan siklus_persetujuan; EFEK notifikasi sesuai kolom "Diberi tahu"; nomor registrasi dibuat di T03.
4. Migrasi data: pemetaan status lama (bagian 13), riwayat dengan pelaku sistem, jalur inventaris untuk Legal.
5. Tes: setiap baris T01–T38 (sah, pelaku salah 403, status salah 409, alasan kosong), four-eyes, siklus persetujuan, kunci kolom pokok, migrasi, dan regresi seluruh tes pemantauan masa berlaku.

Batasan: butir [TERBUKA] yang belum diputuskan (T23, T25–T27, konfirmasi Unit/Finance di T28) dibuat bisa dinyalakan lewat pengaturan, bawaan mati, kecuali saya memutuskan lain.
```

### S5. Layar alur

```text
Kerjakan tahap S5 sesuai docs/sop/ATURAN_ALUR_SOP.md bagian 14.

Tugas:
1. client/src/pages/Form.jsx: form usulan bertahap mengikuti urutan Formulir A–H, simpan draf, ringkasan sebelum "Ajukan ke atasan". Label memakai istilah Formulir.
2. client/src/pages/Detail.jsx: tab Usulan (A–J, bagian J hanya diisi Partnership), tab Brief Legal, garis waktu tahap SOP (B sampai 8) dengan pemegang berkas dan status SLA, tombol aksi dari transisiTersedia, kolom alasan wajib untuk pengembalian/penolakan.
3. Dashboard: antrean "menunggu saya" per peran, corong usulan untuk Partnership.
4. Peringatan P4 (sebelum aktif) dan P5 (NDA belum ada + data sensitif).
5. Tangani kondisi kosong, memuat, gagal. Warna selalu disertai label.
6. Uji manual alur penuh dengan akun demo: usulan → atasan → seleksi → kajian → Finance → Pimpinan → konfirmasi mitra → brief → Legal → draf → konfirmasi → finalisasi → TTD → aktif. Laporkan hasil tiap langkah.

Batasan: tampilan hanya mengikuti server; jangan menambah aturan di client yang tidak ada di server.
```

### S6. Eskalasi SLA

```text
Kerjakan tahap S6 sesuai docs/sop/ATURAN_ALUR_SOP.md bagian 11 butir 6–7.

Tugas:
1. server/jobs.js: jalankanEskalasiSla, idempoten lewat tabel eskalasi_sla (migrasi baru, unik per kontrak, riwayat masuk kelompok, tingkat).
2. Penerima per tingkat: pemegang berkas → atasan_id atau kepala peran → Head Partnership/Head Legal. Kelompok milik Unit atau Pimpinan naik ke Head Partnership.
3. Panggil dari job pengingat 07:00 WIB yang sudah ada; gabungkan ke ringkasan email harian (tanpa nilai).
4. Tampilkan riwayat eskalasi di detail kontrak.
5. Tes: job dua kali tidak ganda; tingkat naik sesuai hari kerja; penerima benar; berkas yang sudah pindah tahap tidak dieskalasi.
```

### S7. Addendum, perpanjangan, pengakhiran

```text
Kerjakan tahap S7 sesuai docs/sop/ATURAN_ALUR_SOP.md bagian 4 dan T32, T34, T36, T37.

Tugas:
1. Endpoint "Ajukan addendum / perpanjangan / pengakhiran" dari kontrak aktif membuat usulan anak dengan kontrak_induk_id dan isian awal dari induk.
2. Membuat anak perpanjangan memindahkan induk ke negosiasi_perpanjangan (T34). Anak ditolak/dibatalkan mengembalikan induk ke aktif (T37).
3. T32 menerapkan efek ke induk dalam satu transaksi (perpanjangan, addendum, pengakhiran) dan mencatat riwayat di keduanya.
4. Batasi endpoint perpanjangan langsung hanya untuk konfirmasi auto-renew (sesuai keputusan K9).
5. Tombol "Ajukan perpanjangan" di tabel prioritas dashboard membuka usulan anak.
6. Tes ketiga efek, pembatalan anak, dan reminder induk yang direset setelah perpanjangan.
```

### S8. Dashboard dan laporan

```text
Kerjakan tahap S8 sesuai docs/sop/ATURAN_ALUR_SOP.md bagian 14 butir 3–4.

Tugas:
1. Corong usulan per periode (masuk seleksi, lolos seleksi, disetujui pimpinan, ditandatangani, ditolak, dibatalkan).
2. Kepatuhan SLA per kelompok dan per pemegang berkas (persentase tepat waktu, rata-rata hari kerja).
3. Daftar berkas terlambat dengan tingkat eskalasi.
4. Ekspor CSV memuat nomor registrasi, jenis permintaan, tahap, pemegang berkas, status SLA. Kolom nilai mengikuti hak akses. Netralkan sel berawalan =, +, -, @.
5. Tes angka dengan data fiktif dan pembatasan kolom per peran.
```

### S9. Penutup

```text
Kerjakan tahap S9.

Tugas:
1. Perbarui README.md (peran, alur, aturan bisnis, "Belum ada"), CLAUDE.md bagian 5, dan ATURAN.md bagian 6 agar sesuai docs/sop/ATURAN_ALUR_SOP.md. Tunjukkan diff dan tunggu persetujuan.
2. Jalankan seluruh tes dan laporkan hasilnya apa adanya.
3. Jalankan Prompt Laporan Kesesuaian SOP (bagian F).
```

---

## D. Prompt Verifikasi Tahap (setelah tiap tahap)

```text
Verifikasi tahap {S..} yang baru selesai terhadap docs/sop/ATURAN_ALUR_SOP.md dan docs/sop/RENCANA_PERBAIKAN_SOP.md. Jangan mengubah kode.

Laporkan dalam tabel: butir aturan (nomor T.. atau bagian), status (terpenuhi / sebagian / belum), bukti (berkas:baris dan nama tes), catatan.
Lalu sebutkan:
- tes yang berubah perilakunya dan alasannya;
- hal yang tidak bisa kamu verifikasi dari kode;
- pekerjaan yang tersisa untuk tahap ini.
```

---

## E. Prompt Tinjauan Keamanan

```text
Tinjau keamanan diff cabang ini terhadap main, dengan fokus perubahan alur SOP. Jangan memperbaiki apa pun dulu.

Periksa dan laporkan per temuan (keparahan, berkas:baris, penjelasan, saran):
1. Transisi yang bisa dilewati: pelaku tanpa hak, status di luar tabel, four-eyes yang bisa diakali (misalnya membuat lalu menyetujui lewat akun lain dalam divisi sama).
2. Isolasi divisi untuk pic dan atasan_unit di semua endpoint baru (IDOR).
3. Kebocoran nilai (nilai_kontrak, estimasi_nilai) ke peran tanpa hak, termasuk di notifikasi, email, ekspor, dan respons daftar.
4. Data pribadi PIC mitra di log, email, atau audit log.
5. Kunci kolom pokok setelah persetujuan pimpinan dan sahnya persetujuan per siklus.
6. Penomoran registrasi bersamaan dan idempotensi job eskalasi.
7. Tabel yang seharusnya hanya INSERT.
8. Tes yang dihapus atau dilemahkan.

Urutkan berdasarkan keparahan, lalu tanya saya mana yang diperbaiki.
```

---

## F. Prompt Laporan Kesesuaian SOP

```text
Susun laporan kesesuaian aplikasi terhadap SOP Partnership dan Formulir Usulan Kerja Sama, berdasarkan kode saat ini. Jangan mengubah kode.

Gunakan matriks keterlacakan di docs/sop/RENCANA_PERBAIKAN_SOP.md bagian 5. Untuk setiap butir laporkan: status (sesuai / sebagian / belum / bertentangan), bukti di kode dan tes, dan perbaikan yang masih perlu.
Tambahkan:
- butir [TERBUKA] yang masih tersisa;
- perbedaan antara aplikasi dan SOP yang membutuhkan revisi SOP, bukan revisi kode;
- risiko yang tersisa.
Tulis hasilnya ke docs/sop/LAPORAN_KESESUAIAN_SOP.md.
```

---

## G. Prompt Utilitas

**Mengubah aturan alur**

```text
Saya ingin mengubah aturan alur: {aturan lama} menjadi {aturan baru}.

Tugas: (1) jelaskan dampaknya pada tabel transisi T.., SLA, hak akses, notifikasi, migrasi, dan tes; (2) usulkan perubahan teks pada docs/sop/ATURAN_ALUR_SOP.md; (3) tunggu persetujuan saya sebelum mengubah kode.
```

**Perbaikan bug alur**

```text
Ada bug di alur: {deskripsi dengan data FIKTIF}. Status awal: {status}. Peran: {peran}. Aksi: {aksi}. Yang terjadi: {hasil}. Yang diharapkan menurut docs/sop/ATURAN_ALUR_SOP.md {T.. / bagian ..}: {harapan}.

Tugas: temukan akar masalah, buat tes yang gagal lebih dulu, perbaiki sekecil mungkin, pastikan seluruh tes lulus. Laporkan dampak keamanan.
```
