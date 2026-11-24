# ATURAN.md — Aturan Pengembangan SiMoU

Aturan kerja untuk siapa pun (manusia atau Claude) yang membangun dan memelihara SiMoU.
Rujukan: `CLAUDE.md` (konteks), `BREAKDOWN.md` (spesifikasi), `SECURITY.md` (keamanan), `PROMPT.md` (prompt kerja).
Urutan prioritas: `SECURITY.md` > `BREAKDOWN.md` > `ATURAN.md` > `CLAUDE.md`.

---

## 1. Prinsip Utama

1. **Keamanan lebih dulu.** Jika cepat dan aman bertentangan, pilih aman.
2. **Server adalah sumber kebenaran.** Validasi dan hak akses di server, bukan di tampilan.
3. **Jangan berasumsi pada hal yang belum diputuskan.** Tanyakan hal bertanda **[TERBUKA]** sebelum membangun.
4. **Perubahan kecil dan teruji.** Satu fitur per perubahan, dengan tes.
5. **Data tidak hilang.** Soft delete, riwayat tetap, audit log tidak bisa diubah.
6. **Sederhana dulu.** Bangun MVP, jangan menambah fitur di luar `BREAKDOWN.md` tanpa persetujuan.

---

## 2. Bahasa dan Penamaan

- Antarmuka, pesan error ke pengguna, dan dokumentasi: **Bahasa Indonesia**.
- Nama tabel dan kolom database: Bahasa Indonesia, `snake_case`, huruf kecil (mis. `kontrak`, `tanggal_berakhir`).
- Istilah kerangka kerja dan teknis umum (controller, service, middleware, migration) tetap bahasa Inggris.
- Konsisten dengan istilah di `CLAUDE.md` bagian 2. Jangan membuat sinonim baru (mis. jangan campur "kontrak", "perjanjian", "agreement" untuk hal yang sama).
- Nama enum dan nilai status persis seperti di `BREAKDOWN.md` (`review_legal`, `menunggu_ttd`, dan seterusnya).

---

## 3. Aturan Kode

- Satu tanggung jawab per fungsi/kelas. Logika bisnis di lapisan layanan (service), bukan di controller atau tampilan.
- Logika status dan perhitungan (sisa hari, tingkat perhatian, batas notice, transisi) berada di **satu modul** yang diuji, tidak disalin ke banyak tempat.
- Semua konstanta bisnis (ambang hari, ambang Direksi, ukuran maks unggah, domain tautan) dibaca dari `pengaturan`, **tidak di-hardcode**.
- Tidak ada "angka ajaib" tanpa nama. Tidak ada kode yang dikomentari lalu ditinggalkan.
- Tangani error secara eksplisit. Jangan menelan exception diam-diam. Respons error ke klien generik, detail ke log internal.
- Tidak ada `TODO` yang menyangkut keamanan dibiarkan di cabang utama.
- Gunakan pustaka standar framework untuk autentikasi, CSRF, hashing, dan validasi. **Dilarang** membuat sendiri.
- Tambah dependensi baru hanya bila perlu dan sesuai `SECURITY.md` bagian 13. Sebutkan alasan di deskripsi perubahan.
- Format dan linter wajib lolos sebelum commit.

---

## 4. Aturan Database

- Semua perubahan skema lewat **migrasi** bertahap dan dapat dibalik (rollback) bila memungkinkan. Dilarang mengubah skema manual di produksi.
- Gunakan tipe yang tepat: `uuid`, `date`, `timestamptz`, `numeric(18,2)` untuk uang. **Dilarang** `float` untuk uang.
- Pasang constraint di database (NOT NULL, UNIQUE, CHECK, FOREIGN KEY), bukan hanya di aplikasi.
- Tabel `audit_log`, `riwayat_status`, `persetujuan`: hanya INSERT. Tidak ada UPDATE/DELETE dari aplikasi.
- Tidak ada hapus permanen pada data bisnis. Pakai `diarsipkan_pada`.
- Query berparameter. Hindari N+1; gunakan indeks sesuai `BREAKDOWN.md` bagian 5.
- Data seed hanya berisi data **fiktif** dan master dasar. Tidak ada data asli di seed.

---

## 5. Aturan Tanggal, Uang, dan Format

- Zona waktu bisnis: **Asia/Jakarta**. Simpan timestamp dalam UTC. Hitung "hari ini" menurut Asia/Jakarta.
- Format tampilan tanggal `dd MMM yyyy` (mis. 23 Nov 2026). Format penyimpanan/impor `YYYY-MM-DD`.
- Uang: tampil `Rp 1.234.567,00`. Simpan angka mentah dan kode mata uang. **Jangan menjumlahkan lintas mata uang** tanpa kurs yang disepakati.
- Perhitungan sisa hari memakai selisih tanggal kalender, bukan jam.

---

## 6. Aturan Bisnis yang Tidak Boleh Dilanggar

1. Status berubah **hanya** lewat tabel transisi (`BREAKDOWN.md` bagian 4). Server menolak transisi di luar tabel.
2. Status `aktif` mensyaratkan dokumen `final_ttd` dan tanggal lengkap.
3. "Mendekati Berakhir" adalah penanda turunan, bukan status tersimpan.
4. Reminder dihitung dari `tanggal_berakhir` **dan** `tanggal_batas_notice`.
5. Kontrak auto-renew tidak otomatis menjadi `berakhir` di H0. Butuh konfirmasi Legal.
6. Penyetuju tidak boleh sama dengan pembuat kontrak pada tahap Legal/Finance/Direksi.
7. Perpanjangan menaikkan `siklus_perpanjangan` dan mereset reminder, riwayat lama tetap.
8. Nilai kontrak dikelompokkan per mata uang di semua agregasi.
9. Perubahan pada aturan di atas butuh persetujuan pemilik sistem dan pembaruan `BREAKDOWN.md`.

---

## 7. Aturan Antarmuka

- Tampilkan hanya aksi yang valid untuk peran dan status saat ini, tetapi **tetap** periksa di server.
- Sembunyikan kolom/kartu sensitif untuk peran tanpa hak (dan pastikan data memang tidak dikirim dari server).
- Tingkat perhatian memakai warna **dan** label/ikon.
- Pesan error singkat, jelas, dalam Bahasa Indonesia, tanpa detail teknis atau jejak tumpukan (stack trace).
- Kondisi kosong, memuat, dan gagal selalu ditangani, tidak dibiarkan layar kosong.
- Konfirmasi untuk aksi berisiko (putus kontrak, arsipkan, impor massal).

---

## 8. Aturan Pengujian

- Setiap fitur disertai tes. Logika perhitungan dan transisi status wajib memiliki tes unit yang mencakup nilai batas (lihat `BREAKDOWN.md` bagian 15).
- Setiap endpoint diuji untuk **setiap peran**, termasuk akses lintas divisi (IDOR) dan pembatasan kolom.
- Fitur unggah/impor/ekspor diuji dengan input berbahaya (file palsu, makro, rumus CSV, tautan terlarang).
- Tes tidak boleh memakai data asli. Gunakan data fiktif.
- Dilarang melemahkan atau menghapus tes agar build lolos. Bila tes salah, perbaiki dengan alasan tertulis.
- Build/merge hanya bila semua tes, linter, dan pemindaian keamanan lolos.

---

## 9. Aturan Git dan Perubahan

- Cabang utama dilindungi. Kerja di cabang fitur, merge lewat pull request dan peninjauan.
- Pesan commit jelas dan singkat, dalam Bahasa Indonesia atau Inggris secara konsisten: `fitur: ...`, `perbaikan: ...`, `keamanan: ...`.
- Satu pull request = satu tujuan. Sertakan: apa yang berubah, mengapa, cara menguji, dampak keamanan.
- **Dilarang** meng-commit: rahasia, `.env`, data asli, berkas dump database, hasil ekspor, dokumen kontrak.
- **Dilarang** `force push` ke cabang bersama dan melewati peninjauan.

---

## 10. Kapan Harus Bertanya Dulu

Berhenti dan tanyakan ke pengguna bila:
- hal bertanda **[TERBUKA]** menyangkut pekerjaan yang akan dilakukan (mis. pilihan stack, ambang persetujuan Direksi, penyimpanan dokumen);
- perubahan menyentuh aturan bisnis bagian 6, matriks hak akses, atau `SECURITY.md`;
- perubahan bersifat merusak atau tidak bisa dibalik (hapus data, ubah skema produksi, ganti kunci enkripsi);
- permintaan bertentangan dengan dokumen ini atau `SECURITY.md`;
- ada ambiguitas yang membuat dua tafsiran menghasilkan perilaku berbeda pada data nyata.

---

## 11. Larangan

- Menyimpan atau mencatat (log) kata sandi, token, nilai kontrak, klausul, atau isi dokumen.
- Menonaktifkan validasi, CSRF, pemeriksaan hak akses, CSP, atau pemindaian keamanan demi kemudahan.
- Memakai `float` untuk uang, atau menjumlahkan lintas mata uang tanpa kurs.
- Menghapus permanen data bisnis, riwayat, persetujuan, atau audit log.
- Menambah fitur atau dependensi di luar lingkup tanpa persetujuan.
- Menggunakan data asli untuk pengembangan, pengujian, atau prompt AI.
- Menyalin potongan kode dari sumber tidak jelas tanpa memeriksa lisensi dan keamanannya.

---

## 12. Definition of Done

Sebuah fitur dianggap selesai bila:
- [ ] Sesuai `BREAKDOWN.md` (FR terkait terpenuhi)
- [ ] Hak akses per peran diterapkan di server dan diuji
- [ ] Validasi input di server, error generik
- [ ] Aksi sensitif tercatat di audit log
- [ ] Tes unit dan integrasi lulus, termasuk nilai batas
- [ ] Tidak ada rahasia atau data asli di kode, log, atau tes
- [ ] Linter, SAST, pemindaian dependensi, dan pemindaian rahasia lulus
- [ ] Migrasi (bila ada) teruji naik dan turun
- [ ] Dokumentasi diperbarui (termasuk dokumen ini bila aturan berubah)
- [ ] Ditinjau oleh orang lain dan disetujui
