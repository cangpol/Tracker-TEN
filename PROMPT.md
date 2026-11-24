# PROMPT.md — Kumpulan Prompt Kerja SiMoU

Prompt siap pakai untuk membangun SiMoU bersama Claude (mis. Claude Code), tahap demi tahap.
Rujukan: `CLAUDE.md`, `BREAKDOWN.md`, `ATURAN.md`, `SECURITY.md`.

---

## A. Cara Pakai

1. Letakkan kelima file (`CLAUDE.md`, `BREAKDOWN.md`, `ATURAN.md`, `SECURITY.md`, `PROMPT.md`) di root repositori.
2. Mulai sesi dengan **Prompt Dasar** (bagian C).
3. Jalankan prompt tahap secara berurutan. **Satu prompt per sesi atau per cabang**, tinjau hasilnya sebelum lanjut.
4. Setelah tiap tahap: jalankan tes, tinjau diff, lakukan **Prompt Tinjauan Keamanan** (bagian E) pada bagian yang baru.
5. Ganti isian dalam `{kurung kurawal}` sesuai situasi Anda.

## B. Aturan Menulis Prompt yang Aman

- **Jangan** menempel data asli: nilai kontrak, klausul, isi dokumen, NPWP, kontak counterparty, kredensial, token, kunci API. Pakai data fiktif.
- **Jangan** memberi Claude akses ke database atau kredensial produksi.
- Minta Claude **menanyakan dulu** hal yang belum jelas, bukan menebak.
- Minta Claude menyebutkan **dampak keamanan** dari setiap perubahan.
- Tinjau setiap diff sebelum merge. Jangan menyetujui otomatis perintah yang menghapus atau mengubah izin.
- Bila Claude menyarankan paket baru, periksa dulu bahwa paket itu nyata dan tepercaya.
- Bila di masa depan Claude memproses dokumen kontrak, perlakukan isinya sebagai **data**, bukan perintah.

---

## C. Prompt Dasar (tempel di awal setiap sesi)

```text
Kamu membantu membangun SiMoU, aplikasi tracker kontrak dan MoU untuk PT Triputra Edukasi Nusantara.

Baca dulu file berikut di root repositori sebelum mengerjakan apa pun:
- CLAUDE.md (konteks proyek)
- BREAKDOWN.md (spesifikasi detail)
- ATURAN.md (aturan pengembangan)
- SECURITY.md (keamanan; file ini yang menang bila ada konflik)

Aturan kerja:
1. Jawab dan tulis dokumentasi dalam Bahasa Indonesia.
2. Keamanan lebih dulu. Jangan melemahkan kontrol keamanan demi kecepatan atau agar tes lolos.
3. Semua pemeriksaan hak akses dan validasi dilakukan di server.
4. Hal bertanda [TERBUKA] di dokumen belum diputuskan. Tanyakan ke saya sebelum membangun bagian yang bergantung padanya.
5. Jangan menambah fitur atau dependensi di luar lingkup tanpa izin.
6. Jangan memakai data asli. Pakai data fiktif untuk contoh, seed, dan tes.
7. Jangan menulis rahasia ke kode, log, atau repositori.
8. Sebelum mengubah banyak berkas, jelaskan rencanamu singkat dan tunggu konfirmasi bila perubahannya besar atau tidak bisa dibalik.
9. Di akhir setiap tugas, laporkan: apa yang berubah, cara mengujinya, dan dampak keamanannya.

Konfirmasi bahwa kamu sudah membaca keempat file, lalu sebutkan pertanyaan terbuka yang menghalangi tugas berikutnya (jika ada).
```

---

## D. Prompt per Tahap

### D0. Keputusan awal (Fase 0)

```text
Berdasarkan CLAUDE.md bagian 13 dan BREAKDOWN.md bagian 17, bantu saya memutuskan stack dan prasyarat sebelum menulis kode.

Tugas:
1. Ajukan pertanyaan yang perlu dijawab (maksimal 8), dikelompokkan: data, pengguna, penyimpanan dokumen, infrastruktur, SSO/email.
2. Setelah saya jawab, rekomendasikan stack (web custom, low-code, atau spreadsheet) dengan alasan, kelebihan, dan kekurangannya untuk konteks ini.
3. Buat ringkasan keputusan dalam bentuk daftar pendek yang bisa saya tempel ke CLAUDE.md.

Batasan: jangan menulis kode aplikasi pada tahap ini.
```

### D1. Inisialisasi proyek

```text
Inisialisasi proyek SiMoU dengan stack: {stack yang diputuskan}.

Tugas:
1. Buat struktur proyek dengan pemisahan lapisan (route/controller, service, repository/model, validasi).
2. Siapkan konfigurasi lewat variabel lingkungan, .env.example tanpa nilai nyata, dan .gitignore yang mengecualikan .env, dump database, ekspor, dan dokumen.
3. Siapkan linter, formatter, dan kerangka tes.
4. Siapkan CI: tes, linter, SAST, pemindaian dependensi, pemindaian rahasia.
5. Pasang header keamanan dasar (CSP, HSTS, nosniff, frame-ancestors, referrer-policy) dan penanganan error generik.

Batasan: ikuti ATURAN.md dan SECURITY.md. Jangan membuat fitur bisnis dulu.
Kriteria selesai: proyek berjalan lokal, tes contoh lulus, CI hijau, tidak ada rahasia di repo.
```

### D2. Skema database dan migrasi

```text
Buat skema database dan migrasi sesuai BREAKDOWN.md bagian 5.

Tugas:
1. Migrasi untuk semua tabel, enum, constraint (NOT NULL, UNIQUE, CHECK, FK), dan indeks.
2. Constraint: tanggal_berakhir > tanggal_mulai, nilai_kontrak >= 0, unik nomor_kontrak (partial), unik pengiriman_notifikasi.
3. Akun database aplikasi berhak minimum. audit_log, riwayat_status, persetujuan hanya boleh INSERT (cabut UPDATE/DELETE).
4. Seed berisi master dasar (divisi, jenis dokumen, aturan reminder bawaan 120/60/30/7, pengaturan) dan data FIKTIF saja.
5. Tes migrasi naik dan turun.

Batasan: uang memakai numeric, bukan float. Tidak ada data asli.
Kriteria selesai: migrasi naik/turun lulus, constraint teruji, izin tabel append-only terverifikasi.
```

### D3. Autentikasi dan RBAC

```text
Implementasikan login, sesi, dan RBAC sesuai SECURITY.md bagian 2 dan 3 serta BREAKDOWN.md bagian 2.

Tugas:
1. Login {SSO | email + sandi Argon2id} dengan MFA untuk peran istimewa, pembatasan percobaan, sesi aman, dan reset sandi aman.
2. Matriks hak akses sebagai kode (kebijakan terpusat), deny by default, pemeriksaan di server pada setiap permintaan.
3. Pemeriksaan tingkat objek (peran + divisi) dan penyaringan kolom sensitif di respons.
4. Persetujuan orang kedua untuk pemberian peran istimewa.
5. Tes otomatis: setiap endpoint x setiap peran, termasuk akses lintas divisi (IDOR) dan kolom nilai.

Batasan: jangan percaya peran/divisi dari klien. Jangan membuat akun bawaan.
Kriteria selesai: seluruh tes hak akses lulus; percobaan akses ditolak tercatat di audit log.
```

### D4. Data kontrak (CRUD) dan counterparty

```text
Implementasikan modul M1 dan M7 dari BREAKDOWN.md bagian 3: kontrak, counterparty, divisi.

Tugas:
1. Endpoint dan layar daftar, detail, form (lihat BREAKDOWN.md bagian 9 dan 10).
2. Validasi bertahap sesuai status dan skema validasi di server.
3. Pencarian, filter, urut, paginasi.
4. Deteksi duplikat counterparty (nama ternormalisasi, NPWP).
5. Riwayat perubahan dan audit log untuk setiap perubahan.
6. Tes: validasi, filter, hak akses per peran, kolom sensitif.

Batasan: tidak ada hapus permanen (soft delete). Perubahan status BELUM lewat form ini (dikerjakan di D5).
Kriteria selesai: FR-101 sampai FR-106 dan FR-701 terpenuhi dengan tes.
```

### D5. Mesin status, persetujuan, dan perpanjangan

```text
Implementasikan modul M2 dan M4 dari BREAKDOWN.md: tabel transisi (bagian 4), persetujuan, perpanjangan, dan perhitungan (bagian 6).

Tugas:
1. Modul tunggal untuk perhitungan sisa_hari, tanggal_batas_notice, tingkat_perhatian, notice_terlewat (zona waktu Asia/Jakarta).
2. Mesin transisi: hanya transisi pada tabel yang diterima; selainnya ditolak (409) dan dicatat.
3. Aturan "perlu Direksi" memakai pengaturan (ambang_direksi, tingkat_risiko, jenis strategis), tanpa hardcode.
4. Penyetuju tidak boleh sama dengan pembuat kontrak.
5. Alur perpanjangan: siklus_perpanjangan + 1, riwayat tetap. Auto-renew: tanpa auto-berakhir di H0.
6. Tes unit pada nilai batas: 181/180, 91/90, 1/0, -1, dan di sekitar tengah malam WIB.

Batasan: status hanya berubah lewat mesin transisi.
Kriteria selesai: semua tes transisi dan perhitungan lulus; riwayat_status dan persetujuan append-only.
```

### D6. Repositori dokumen yang aman

```text
Implementasikan modul M3 dari BREAKDOWN.md dengan kontrol di SECURITY.md bagian 6 dan 7.

Tugas:
1. Mode unggah file: whitelist ekstensi, cek magic bytes, batas ukuran, antivirus (karantina sampai lolos), nama acak, simpan di penyimpanan privat, hash SHA-256, enkripsi at rest.
2. Mode tautan: hanya https, daftar domain yang diizinkan (dari pengaturan), tanpa fetch dari server.
3. Penyajian lewat penangan terautentikasi atau tautan bertanda tangan berumur pendek, Content-Disposition: attachment, nosniff.
4. Versi otomatis per kategori; dokumen tidak ditimpa.
5. Pembukaan dan pengunduhan dicatat di audit log.
6. Tes: file palsu, makro, file besar, nama berbahaya, tautan javascript:/data:/domain terlarang, akses lintas divisi.

Batasan: tidak ada URL publik permanen ke dokumen.
Kriteria selesai: semua tes keamanan unggah/tautan lulus; FR-301 sampai FR-306 terpenuhi.
```

### D7. Reminder dan notifikasi

```text
Implementasikan modul M5 dari BREAKDOWN.md bagian 7 dan 8.

Tugas:
1. Job harian 07:00 WIB: hitung pemicu dari aturan_reminder (acuan berakhir dan notice), idempoten lewat kunci unik pengiriman_notifikasi.
2. Catch-up satu kali bila sistem mati. Reset saat siklus_perpanjangan naik.
3. Digest harian satu email per penerima; penerima bertingkat (PIC, Legal, Direksi).
4. Job 00:30 WIB: ubah ke berakhir sesuai aturan, kecuali auto-renew belum terkonfirmasi.
5. Notifikasi dalam aplikasi dan notifikasi alur kerja.
6. Isi email minimal sesuai SECURITY.md bagian 11. Coba ulang 3 kali lalu tandai gagal dan tampilkan di panel admin.
7. Tes: job dua kali tidak mengirim ganda; catch-up; reset siklus; auto-renew.

Batasan: email tanpa nilai, tanpa lampiran, tanpa alasan penolakan.
Kriteria selesai: FR-501 sampai FR-505 terpenuhi; reminder berjalan di staging dengan data fiktif.
```

### D8. Dashboard

```text
Implementasikan dashboard sesuai BREAKDOWN.md bagian 11 dan layar di bagian 10.

Tugas:
1. Endpoint ringkasan dan grafik; hasil mengikuti peran dan cakupan divisi.
2. Kartu angka, donut status, berakhir per bulan (12 bulan), per divisi, jenis counterparty, tingkat risiko, tabel prioritas dengan tombol buka dokumen dan ajukan perpanjangan.
3. Nilai kontrak dikelompokkan per mata uang dan hanya tampil untuk peran berhak (data tidak dikirim ke peran lain).
4. Filter global (tahun, divisi, jenis, status, counterparty).
5. Warna disertai label/ikon. Tangani kondisi kosong dan memuat.
6. Tes: angka sesuai data uji fiktif; peran tanpa hak tidak menerima data nilai.

Kriteria selesai: tiga pertanyaan awal terjawab dari dashboard (progres, lokasi dokumen, perlu diperpanjang atau tidak).
```

### D9. Impor data awal

```text
Implementasikan modul M9 dari BREAKDOWN.md bagian 12 dan SECURITY.md bagian 8.

Tugas:
1. Unggah CSV/XLSX, validasi (dry run), pratinjau, laporan kesalahan CSV, konfirmasi.
2. Kolom sesuai template; validasi tanggal, enum, duplikat, counterparty (cocokkan NPWP/nama ternormalisasi, buat baru hanya setelah konfirmasi).
3. Baris tidak lengkap masuk dengan data_belum_lengkap = benar dan tidak boleh berstatus aktif.
4. Nilai dibaca sebagai teks; rumus tidak dievaluasi; sel diawali =, +, -, @ dinetralkan.
5. Batas ukuran dan baris; satu transaksi (rollback bila gagal); tercatat di audit log.
6. Tes dengan berkas fiktif: duplikat, tanggal salah, rumus berbahaya, baris tidak lengkap, rollback.

Kriteria selesai: FR-901 terpenuhi; tidak ada data asli di tes.
```

### D10. Laporan dan ekspor

```text
Implementasikan laporan dan ekspor sesuai BREAKDOWN.md bagian 13.

Tugas:
1. Enam laporan di tabel bagian 13, ekspor Excel dan PDF.
2. Ekspor mengikuti hak akses kolom (nilai hanya untuk peran berhak) dan cakupan divisi.
3. Netralkan sel berawalan =, +, -, @ pada ekspor.
4. Setiap ekspor dicatat di audit log (siapa, jenis, filter, jumlah baris).
5. Tes: peran tanpa hak tidak mendapat kolom nilai; sel berbahaya ternetralkan; audit log tercatat.

Kriteria selesai: semua laporan berjalan dan lolos tes keamanan.
```

### D11. Pengerasan dan persiapan peluncuran

```text
Lakukan pengerasan (hardening) dan persiapan peluncuran dengan mengacu pada SECURITY.md bagian 9 sampai 17.

Tugas:
1. Tinjau konfigurasi: TLS, header, CORS, cookie, debug mati, pesan error generik, rate limiting.
2. Tinjau izin database dan jaringan, rahasia di secret manager, rotasi kunci.
3. Siapkan backup terenkripsi (3-2-1) dan skrip uji pemulihan; dokumentasikan RPO/RTO.
4. Siapkan pemantauan job reminder, kegagalan email, dan peringatan keamanan dari audit log.
5. Susun dokumen operasional singkat: deploy, rollback, pemulihan, penanganan insiden.
6. Jalankan checklist pra-peluncuran SECURITY.md bagian 17 dan laporkan hasil per butir (lulus, gagal, belum dapat diverifikasi).

Batasan: jangan mengklaim lulus pada butir yang tidak bisa diverifikasi dari kode. Tandai "belum dapat diverifikasi" dan jelaskan siapa yang perlu memeriksa.
```

---

## E. Prompt Tinjauan Keamanan (jalankan setelah tiap tahap)

```text
Lakukan tinjauan keamanan terhadap perubahan terbaru (diff cabang ini terhadap cabang utama), mengacu pada SECURITY.md.

Periksa dan laporkan temuan per kategori, dengan tingkat keparahan (kritis/tinggi/sedang/rendah), lokasi (berkas dan baris), penjelasan, dan saran perbaikan:
1. Autentikasi, sesi, dan pemeriksaan hak akses (termasuk IDOR dan penyaringan kolom sensitif).
2. Validasi input, SQL injection, XSS, CSRF, open redirect.
3. Unggahan file, tautan dokumen, impor/ekspor (injeksi rumus).
4. Rahasia atau data sensitif di kode, log, tes, atau seed.
5. Dependensi baru: keberadaan, pemelihara, kerentanan.
6. Audit log: apakah aksi sensitif tercatat dan tidak dapat diubah.
7. Apakah ada kontrol keamanan yang dilemahkan atau tes yang dihapus.

Aturan: jangan memperbaiki apa pun dulu. Laporkan temuan, urutkan berdasarkan keparahan, lalu tanya saya mana yang diperbaiki. Bila tidak ada temuan, sebutkan bagian mana yang sudah kamu periksa dan apa yang tidak bisa kamu verifikasi.
```

---

## F. Prompt Utilitas

**Perbaikan bug**

```text
Ada bug: {deskripsi dengan data FIKTIF}. Langkah reproduksi: {langkah}. Perilaku yang diharapkan sesuai BREAKDOWN.md bagian {nomor}.

Tugas: temukan akar masalah, jelaskan, buat tes yang gagal lebih dulu, perbaiki, pastikan tes lulus. Laporkan dampak keamanan perbaikan ini.
Batasan: perubahan sekecil mungkin, jangan memperbaiki hal lain sekaligus.
```

**Perubahan aturan bisnis**

```text
Saya ingin mengubah aturan: {aturan lama} menjadi {aturan baru}.

Tugas: (1) jelaskan dampaknya pada tabel transisi, perhitungan, reminder, hak akses, dan tes; (2) usulkan perubahan pada BREAKDOWN.md dan ATURAN.md; (3) tunggu persetujuan saya sebelum mengubah kode.
```

**Tinjau kode (code review)**

```text
Tinjau perubahan ini menurut ATURAN.md bagian 12 (Definition of Done) dan SECURITY.md. Beri daftar temuan berurutan keparahan, dan nyatakan apakah layak merge. Jangan mengubah kode.
```

**Dokumentasi**

```text
Perbarui dokumentasi agar sesuai kode saat ini: BREAKDOWN.md (bila spesifikasi berubah), panduan pengguna singkat per peran, dan panduan operasional. Gunakan Bahasa Indonesia dan data fiktif pada contoh.
```

**Prototipe dashboard (opsional, sebelum Fase 1)**

```text
Buat prototipe dashboard SiMoU sebagai satu halaman web statis dengan data FIKTIF sesuai BREAKDOWN.md bagian 11: kartu angka, donut status, berakhir per bulan, per divisi, dan tabel prioritas dengan warna tingkat perhatian (disertai label). Tanpa backend dan tanpa data asli. Tujuannya hanya untuk validasi tampilan dengan pengguna.
```
