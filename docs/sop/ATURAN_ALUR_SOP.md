# ATURAN_ALUR_SOP.md — Aturan Alur Kerja Sama Sesuai SOP Partnership

Aturan ini menyesuaikan Partnership TEN dengan dua dokumen perusahaan:

- **SOP Kerja Sama dengan Mitra: dari Usulan hingga Penandatanganan** (Corporate Partnership), disingkat **SOP**.
- **Formulir Usulan Kerja Sama** bagian A–J, disingkat **Formulir**.

Dokumen ini menjadi sumber kebenaran untuk **alur status, peran alur, SLA, dan data usulan**. Untuk hal itu, dokumen ini menggantikan `CLAUDE.md` bagian 5 dan tabel transisi lama di `server/logika.js` dan `server/akses.js`. Aturan lain di `CLAUDE.md`, `ATURAN.md`, dan `SECURITY.md` tetap berlaku.

Butir bertanda **[TERBUKA]** belum diputuskan pemilik sistem. Claude wajib bertanya sebelum membangun bagian yang bergantung padanya, dan memakai nilai bawaan yang tertulis hanya bila diminta.

---

## 1. Ringkasan SOP (rujukan kerja)

| Kode | Langkah SOP | Pemilik | Output | Target SOP |
|---|---|---|---|---|
| A | Penjajakan awal, tanpa komitmen. NDA lebih dulu bila informasi sensitif dibagikan | Unit Pengusul | — | — |
| B | Isi Formulir A–H, lampiran, persetujuan atasan (bagian I), kirim ke Partnership. Penawaran dari mitra dicatat sebagai usulan di C | Unit Pengusul | Formulir disetujui atasan | — |
| C | Seleksi: catat, beri nomor registrasi (bagian J), nilai strategi/kelayakan/prioritas. Hasil: lanjut, perlu diperbaiki, ditolak | Partnership | Keputusan | 3 hari |
| D | Kajian skema: manfaat, risiko, bentuk, pokok kerja sama. Finance dilibatkan bila ada nilai uang/anggaran | Partnership (+ Finance) | Nota kajian | 5 hari (D–E) |
| E | Persetujuan pimpinan tertulis sesuai batas kewenangan dan nilai. Tanpa itu tidak boleh ke Legal. Tidak disetujui = ditutup | Pimpinan | Persetujuan tertulis | (bersama D) |
| F | Konfirmasi pokok kerja sama ke calon mitra. Perubahan pokok dari mitra dilaporkan ke Partnership | Unit Pengusul | Mitra siap | — |
| 1 | Tetapkan kebutuhan legal: baru, perubahan, perpanjangan, pengakhiran | Partnership | Jenis permintaan | 2 hari (1–2) |
| 2 | Isi Legal Brief Request: tujuan, ruang lingkup, profil mitra, PIC, lampiran, bukti persetujuan pimpinan | Partnership | Brief | (bersama 1) |
| 3 | Catat dan periksa kelengkapan. Kurang = kembali ke Partnership (tahap 2). Legal tidak mulai analisis sebelum lengkap | Legal | Brief lengkap / dikembalikan | 1 hari |
| 4 | Analisis kebutuhan hukum: jenis dokumen, isu, klausul, risiko | Legal | Analisis | 3 hari |
| 5 | Susun dan reviu draf MoU/MoA/PKS/addendum, serahkan ke Partnership | Legal | Draf | 5 hari |
| 6 | Konfirmasi substansi: tujuan, ruang lingkup, output, kewajiban. Belum sesuai = kembali ke tahap 5 | Partnership | Substansi sesuai | 3 hari (6–7) |
| 7 | Finalisasi: Partnership menyetujui substansi, Legal menyatakan siap ditandatangani | Partnership + Legal | Naskah final | (bersama 6) |
| 8 | Tanda tangan pejabat berwenang, distribusi salinan; Legal mencatat dan menyimpan arsip asli | Partnership (arsip: Legal) | Dokumen bertanda tangan tercatat | Sesuai jadwal |

**Pengendalian SOP** yang wajib diterjemahkan ke aplikasi:

- **P1 Pengembalian:** selalu dengan catatan tertulis bagian yang kurang. Pengajuan ulang = permintaan baru untuk perhitungan waktu.
- **P2 Penolakan:** ditutup dengan alasan tercatat dan diberitahukan ke Unit Pengusul. Mengajukan ulang usulan yang sama butuh perubahan substansial.
- **P3 Eskalasi:** target waktu terlampaui → pihak yang menunggu mengingatkan PIC → atasan masing-masing → Head Partnership atau Head Legal.
- **P4 Larangan:** unit tidak menandatangani, menjanjikan nilai, atau memulai pelaksanaan sebelum dokumen ditandatangani pejabat berwenang.
- **P5 Kerahasiaan:** informasi hanya dibagikan setelah NDA berlaku, kecuali Legal menyatakan tidak perlu.
- **P6 Arsip:** Partnership menyimpan Formulir, nota kajian, persetujuan; Legal menyimpan dokumen asli. Semua berkas memakai **nomor registrasi yang sama**.
- **P7 Perubahan setelah persetujuan:** perubahan pokok (nilai, ruang lingkup, jangka waktu) setelah tahap E dilaporkan ke Partnership dan dapat memerlukan persetujuan ulang.

---

## 2. Peran

| Peran (kode) | Padanan SOP | Status | Hak inti |
|---|---|---|---|
| `pic` (label: Unit Pengusul) | Unit Pengusul | Sudah ada | Buat dan ubah usulan unitnya, ajukan ke atasan, konfirmasi mitra, perbaiki usulan yang dikembalikan |
| `atasan_unit` | Atasan unit pengusul | **Baru** | Setujui atau kembalikan usulan unitnya (Formulir bagian I). Cakupan divisi sendiri |
| `partnership` | Divisi Partnership | **Baru** | Seleksi, nomor registrasi, kajian, brief Legal, konfirmasi substansi, atur TTD. Lihat semua unit |
| `direksi` (label: Pimpinan) | Pimpinan | Sudah ada | Persetujuan tahap E sesuai batas kewenangan |
| `legal` | Divisi Legal | Sudah ada | Tahap 3–5 dan 7, catat dokumen asli, aktifkan kontrak |
| `finance` | Finance | Sudah ada | Tinjau usulan bernilai uang/anggaran di tahap D |
| `admin_sistem`, `viewer` | — | Sudah ada | Tidak berubah |

Tambahan pada `pengguna`:

- `kepala` (boolean): menandai Head Partnership dan Head Legal sebagai tujuan eskalasi tingkat akhir (P3).
- `atasan_id` (FK ke `pengguna`, opsional): atasan langsung untuk eskalasi tingkat 2. **[TERBUKA]** apakah struktur atasan dikelola di aplikasi atau cukup per peran.

Aturan peran:

1. `partnership` dan `atasan_unit` termasuk peran istimewa: pemberiannya butuh persetujuan Admin Sistem kedua (four-eyes, sama seperti `legal`).
2. `atasan_unit` hanya melihat usulan divisinya sendiri (seperti `pic`).
3. Pemberi keputusan pada setiap titik keputusan **tidak boleh** sama dengan pembuat usulan (aturan four-eyes lama diperluas ke semua titik keputusan baru).
4. **[TERBUKA] Visibilitas nilai.** Formulir bagian F meminta Unit Pengusul mengisi estimasi nilai, sedangkan `CLAUDE.md` aturan 10 membatasi nilai kontrak hanya untuk Legal, Finance, Direksi. Usulan bawaan: kolom terpisah `estimasi_nilai` di data usulan, terlihat oleh pembuat, atasan unit, Partnership, Finance, Legal, Direksi; kolom `nilai_kontrak` final tetap dibatasi seperti sekarang.

---

## 3. Satu berkas, satu nomor registrasi

1. Satu usulan = satu baris `kontrak` dari awal sampai arsip. Status awalnya `usulan_draft`.
2. **Nomor registrasi** dibuat otomatis saat usulan masuk ke Partnership (transisi `menunggu_atasan → seleksi`), unik, tidak bisa diubah, dan tampil di semua layar, dokumen, notifikasi, dan ekspor.
3. Format bawaan `REG/PTN/{YYYY}/{NNNN}`, urut per tahun, dibuat di dalam transaksi dengan kunci agar tidak ganda. **[TERBUKA]** format resmi.
4. `nomor_kontrak` tetap terpisah dan baru wajib saat `aktif`.
5. Penawaran yang datang langsung dari mitra dibuat oleh Partnership dengan `sumber_usulan = penawaran_mitra`, langsung berstatus `seleksi`, dan wajib menunjuk divisi pemilik. **[TERBUKA]** siapa yang menunjuk unit pemilik.

---

## 4. Jenis permintaan

Kolom `jenis_permintaan`: `baru`, `addendum`, `perpanjangan`, `pengakhiran` (Formulir bagian C, SOP tahap 1).

1. `addendum`, `perpanjangan`, `pengakhiran` wajib menunjuk `kontrak_induk_id` (kontrak berstatus `aktif` atau `negosiasi_perpanjangan`).
2. Ketiganya melewati alur yang sama dengan `baru`.
3. Berkas anak tidak menjadi `aktif`. Setelah tanda tangan, berkas anak berakhir di status `selesai` dan efeknya diterapkan ke induk dalam satu transaksi:
   - `perpanjangan`: catat perpanjangan pada induk (`tanggal_berakhir` baru, `siklus_perpanjangan + 1`, riwayat lama tetap).
   - `addendum`: dokumen `final_ttd` anak ditautkan ke induk sebagai kategori `adendum`; perubahan kolom pokok induk dicatat di riwayat.
   - `pengakhiran`: induk berpindah ke `diputus` dengan catatan nomor registrasi anak.
4. Saat berkas anak `perpanjangan` dibuat, induk berstatus `aktif` berpindah otomatis ke `negosiasi_perpanjangan`.
5. Endpoint "catat perpanjangan" langsung oleh Legal hanya tersisa untuk **konfirmasi auto-renew** (`perpanjangan_otomatis = ya`). **[TERBUKA]** apakah auto-renew juga wajib lewat alur penuh.
6. Jenis dokumen ditambah `MoA` dan `Addendum`. Nilai lama (`MoU, PKS, NDA, SPK, kontrak_vendor`) tetap.

---

## 5. Status

| Status | Langkah SOP | Pemegang berkas | Kelompok SLA |
|---|---|---|---|
| `usulan_draft` | B | Unit Pengusul | — |
| `menunggu_atasan` | B (bagian I) | Atasan unit | `atasan` |
| `seleksi` | C | Partnership | `seleksi` |
| `kajian` | D | Partnership | `kajian_persetujuan` |
| `review_finance` | D (Finance) | Finance | `kajian_persetujuan` |
| `persetujuan_pimpinan` | E | Pimpinan | `kajian_persetujuan` |
| `konfirmasi_mitra` | F | Unit Pengusul | `konfirmasi_mitra` |
| `brief_legal` | 1–2 | Partnership | `brief` |
| `cek_kelengkapan` | 3 | Legal | `cek_kelengkapan` |
| `analisis_hukum` | 4 | Legal | `analisis` |
| `penyusunan_draf` | 5 | Legal | `draf` |
| `negosiasi_mitra` | 5a (usulan baru, opsional) | Partnership + Unit | `negosiasi` |
| `konfirmasi_substansi` | 6 | Partnership | `konfirmasi_final` |
| `finalisasi` | 7 | Legal | `konfirmasi_final` |
| `menunggu_ttd` | 8 | Partnership | `ttd` |
| `aktif` | pasca-TTD | Unit + Legal | — (dipantau masa berlaku) |
| `negosiasi_perpanjangan` | pasca-TTD | Unit + Legal | — |
| `selesai` | akhir berkas anak | — | — |
| `berakhir`, `diputus`, `ditolak`, `dibatalkan`, `arsip` | akhir | — | — |

Status lama `draft`, `review_legal`, `persetujuan_direksi` dihapus dari daftar setelah migrasi (bagian 13). `review_finance` dipertahankan dengan makna baru (Finance di tahap D).

---

## 6. Tabel transisi

Server menolak semua transisi di luar tabel ini (409) dan mencatat penolakan di audit log. Kolom "Alasan" = catatan tertulis wajib (P1, P2).

| # | Dari | Ke | Pelaku | Syarat server | Alasan | Diberi tahu |
|---|---|---|---|---|---|---|
| T01 | `usulan_draft` | `menunggu_atasan` | pic (divisi sama) | Kolom wajib Formulir A–H lengkap (bagian 8); lampiran wajib dicentang | — | atasan_unit divisi |
| T02 | `usulan_draft` | `dibatalkan` | pic, partnership | — | wajib | — |
| T03 | `menunggu_atasan` | `seleksi` | atasan_unit (divisi sama, ≠ pembuat) | Simpan keputusan bagian I; buat nomor registrasi | — | partnership |
| T04 | `menunggu_atasan` | `usulan_draft` | atasan_unit | — | wajib | pic divisi |
| T05 | `seleksi` | `kajian` | partnership (≠ pembuat) | Prioritas diisi; PIC Partnership ditugaskan | — | pic divisi |
| T06 | `seleksi` | `usulan_draft` | partnership | — (dikembalikan untuk dilengkapi) | wajib | pic divisi |
| T07 | `seleksi` | `ditolak` | partnership | — | wajib | pic, atasan_unit divisi |
| T08 | `kajian` | `review_finance` | partnership | Nota kajian (dokumen `nota_kajian`) ada; usulan bernilai (`estimasi_nilai > 0` atau butuh anggaran) | — | finance |
| T09 | `kajian` | `persetujuan_pimpinan` | partnership | Nota kajian ada; usulan **tidak** bernilai | — | direksi |
| T10 | `kajian` | `usulan_draft` | partnership | — | wajib | pic divisi |
| T11 | `review_finance` | `persetujuan_pimpinan` | finance (≠ pembuat) | Catat persetujuan tahap `finance` | — | direksi |
| T12 | `review_finance` | `kajian` | finance | Catat `kembalikan` tahap `finance` | wajib | PIC Partnership |
| T13 | `persetujuan_pimpinan` | `konfirmasi_mitra` | direksi (≠ pembuat; sesuai matriks kewenangan) | Catat persetujuan tahap `pimpinan` untuk siklus persetujuan saat ini | — | pic divisi, PIC Partnership |
| T14 | `persetujuan_pimpinan` | `ditolak` | direksi | Catat `tolak` tahap `pimpinan` | wajib | pic, atasan_unit, PIC Partnership |
| T15 | `persetujuan_pimpinan` | `kajian` | direksi | Catat `kembalikan` | wajib | PIC Partnership |
| T16 | `konfirmasi_mitra` | `brief_legal` | pic (divisi sama) | Konfirmasi mitra dicatat (tanggal, catatan) | — | PIC Partnership |
| T17 | `konfirmasi_mitra` | `kajian` | pic, partnership | Mitra mengubah pokok (P7); naikkan `siklus_persetujuan` | wajib | PIC Partnership |
| T18 | `konfirmasi_mitra` | `dibatalkan` | partnership | Mitra mundur | wajib | pic divisi |
| T19 | `brief_legal` | `cek_kelengkapan` | partnership | Brief lengkap (bagian 9); ada persetujuan `pimpinan` yang sah untuk siklus saat ini | — | legal |
| T20 | `cek_kelengkapan` | `analisis_hukum` | legal (≠ pembuat) | PIC Legal ditugaskan | — | PIC Partnership |
| T21 | `cek_kelengkapan` | `brief_legal` | legal | — | wajib | PIC Partnership |
| T22 | `analisis_hukum` | `penyusunan_draf` | legal | Catatan analisis diisi; jenis dokumen final ditetapkan | — | — |
| T23 | `analisis_hukum` | `kajian` | legal | Isu hukum mengubah pokok (P7, perluasan); naikkan `siklus_persetujuan`. **[TERBUKA]** diadopsi atau tidak | wajib | PIC Partnership |
| T24 | `penyusunan_draf` | `konfirmasi_substansi` | legal | Dokumen `draft` versi baru diunggah sejak masuk status ini | — | PIC Partnership, pic divisi |
| T25 | `penyusunan_draf` | `negosiasi_mitra` | legal | Sama dengan T24. **[TERBUKA]** tahap 5a diadopsi atau tidak | — | PIC Partnership, pic divisi |
| T26 | `negosiasi_mitra` | `penyusunan_draf` | partnership | Masukan/redline mitra diunggah (kategori `draft`) | wajib | PIC Legal |
| T27 | `negosiasi_mitra` | `konfirmasi_substansi` | partnership | Mitra menyetujui draf | — | — |
| T28 | `konfirmasi_substansi` | `finalisasi` | partnership (≠ pembuat) | Catat persetujuan tahap `partnership`. **[TERBUKA]** konfirmasi Unit dan Finance (bila bernilai) juga wajib | — | PIC Legal |
| T29 | `konfirmasi_substansi` | `penyusunan_draf` | partnership | — | wajib | PIC Legal |
| T30 | `finalisasi` | `menunggu_ttd` | legal | Dokumen `naskah_final` ada; catat persetujuan tahap `legal` | — | PIC Partnership, pic divisi |
| T31 | `menunggu_ttd` | `aktif` | legal | `jenis_permintaan = baru`; dokumen `final_ttd`; `nomor_kontrak`, `tanggal_ttd`, `tanggal_mulai`, `tanggal_berakhir`, `lokasi_arsip_asli` terisi | — | pic divisi, PIC Partnership |
| T32 | `menunggu_ttd` | `selesai` | legal | `jenis_permintaan ≠ baru`; dokumen `final_ttd`; terapkan efek ke induk (bagian 4) | — | pic divisi, PIC Partnership |
| T33 | `menunggu_ttd` | `dibatalkan` | partnership | — | wajib | pic divisi, legal |
| T34 | `aktif` | `negosiasi_perpanjangan` | sistem | Otomatis saat berkas anak `perpanjangan` dibuat | — | legal |
| T35 | `aktif`, `negosiasi_perpanjangan` | `berakhir` | sistem (job harian) | Aturan lama tetap (auto-renew tidak ikut) | — | — |
| T36 | `aktif`, `negosiasi_perpanjangan` | `diputus` | sistem | Hanya lewat T32 berkas anak `pengakhiran` | — | pic divisi, legal |
| T37 | `negosiasi_perpanjangan` | `aktif` | sistem | Lewat T32 berkas anak `perpanjangan`, atau berkas anak ditolak/dibatalkan | — | pic divisi |
| T38 | `berakhir`, `diputus`, `ditolak`, `dibatalkan`, `selesai` | `arsip` | legal | — | — | — |

Catatan:

- Langkah A (penjajakan) **tidak** menjadi status. Formulir B mencatat status NDA; aplikasi menampilkan peringatan P5 (bagian 11).
- Semua langkah mundur dicatat sebagai `kembalikan` di `persetujuan` bila berasal dari titik keputusan, dan selalu di `riwayat_status`.
- Notifikasi dikirim ke **pemegang berkas yang ditugaskan** (bagian 7). Bila belum ada penugasan, ke semua pengguna aktif peran itu (perilaku lama).
- Isi notifikasi minimal: nomor registrasi, judul, status baru. Tanpa nilai dan tanpa alasan (alasan hanya di aplikasi), sesuai aturan notifikasi lama.

---

## 7. Penugasan (bola di siapa)

1. Tabel baru `penugasan` (hanya INSERT): `kontrak_id, peran (partnership|legal), pengguna_id, ditugaskan_oleh, waktu`. Penugasan terbaru per peran yang berlaku.
2. PIC Partnership wajib ditugaskan di T05. PIC Legal wajib ditugaskan di T20. Head Partnership/Head Legal (`kepala`) dapat memindahkan penugasan dengan alasan.
3. `pic_nama` (teks bebas) diganti `pengusul_id` (akun pembuat usulan) untuk berkas baru. Data lama tetap tampil.
4. Setiap kontrak dalam proses menampilkan **pemegang berkas saat ini**: orang yang ditugaskan, atau peran bila belum ditugaskan.

---

## 8. Data usulan (Formulir A–J)

Tabel baru `usulan` (1:1 dengan `kontrak`). Kolom bertanda * wajib untuk T01.

| Bagian | Kolom |
|---|---|
| A. Pengusul | `pengusul_id`*, `jabatan_pengusul`*, `telepon_pengusul`, `tanggal_pengajuan` (otomatis saat T01), `atasan_id`* |
| B. Calon mitra | `counterparty_id`*; pada `counterparty` ditambah `jenis_mitra`* (perusahaan, instansi_pemerintah, lembaga_pendidikan_riset, ngo_yayasan, asosiasi, perorangan, lainnya), `alamat`, `situs_web`, `pic_mitra_nama`, `pic_mitra_jabatan`, `pic_mitra_kontak`; pada `usulan`: `status_hubungan`* (baru, pernah), `sumber_usulan`* (inisiatif_unit, penawaran_mitra, arahan_pimpinan), `status_nda`* (sudah_ada, belum_ada, tidak_diperlukan), `nda_nomor`, `nda_tanggal` |
| C. Jenis | `jenis_permintaan`*, `bentuk_dokumen_perkiraan`* (MoU, MoA, PKS, Addendum, belum_tahu), `kontrak_induk_id` (wajib bila bukan baru) |
| D. Latar belakang | `latar_belakang`*, `tujuan`*, `alasan_mitra` |
| E. Ruang lingkup | `kegiatan_utama`*, `kewajiban_kita`*, `kewajiban_mitra`*, `output_diharapkan`*, `pihak_internal_terlibat` |
| F. Manfaat dan nilai | `indikator_keberhasilan`*, `estimasi_nilai`, `arah_dana`* (perusahaan_bayar, mitra_bayar, bagi_hasil, tanpa_nilai), `kode_anggaran`, `skema_pembayaran`, `rencana_mulai`, `rencana_selesai` |
| G. Risiko | `risiko` (larik pilihan: data_pribadi, hki, eksklusivitas, nama_logo, pihak_ketiga, mitra_luar_negeri, terkait_pemerintah, tidak_ada)*, `catatan_risiko`, `target_mulai`, `tenggat_ttd`, `alasan_mendesak` |
| H. Lampiran | `lampiran` (larik pilihan: profil_mitra, legalitas_mitra, proposal_mitra, draf_mitra, dokumen_sebelumnya, anggaran, korespondensi); tiap butir yang dicentang wajib punya dokumen kategori `lampiran_usulan` |
| I. Atasan | Dicatat di `persetujuan` tahap `atasan` (pemberi, keputusan, tanggal, catatan) |
| J. Partnership | `nomor_registrasi`, `tanggal_diterima` (saat T03), PIC Partnership (dari `penugasan`), hasil seleksi (dari `persetujuan` tahap `seleksi`), `prioritas` (tinggi, sedang, rendah), alasan, `tindak_lanjut` |

Aturan data:

1. `arah_dana ≠ tanpa_nilai` atau `estimasi_nilai > 0` → usulan dianggap **bernilai** dan wajib lewat `review_finance` (T08).
2. Ada risiko selain `tidak_ada` → `tingkat_risiko` bawaan menjadi `tinggi` sebagai saran, dapat diubah Partnership saat kajian. **[TERBUKA]** pemetaan risiko ke tingkat.
3. Kontak PIC mitra adalah data pribadi pihak ketiga. Ikuti `SECURITY.md`; jangan dicatat di log atau dikirim lewat email.
4. `usulan` dapat diubah pembuat hanya saat `usulan_draft`. Bagian J hanya oleh Partnership.

---

## 9. Legal Brief Request

1. Tabel baru `legal_brief` (1:1 dengan `kontrak`, berversi per pengiriman): `jenis_permintaan`, `tujuan`, `ruang_lingkup`, `profil_mitra`, `pic_partnership_id`, `pic_unit_id`, `lampiran`, `catatan_kebutuhan_legal`, `dikirim_pada`.
2. Saat masuk `brief_legal`, isian diisi otomatis dari `usulan` dan dapat disunting Partnership.
3. Syarat lengkap untuk T19: semua kolom terisi, ada bukti persetujuan pimpinan sah (bagian 10), dan lampiran wajib tersedia.
4. **[TERBUKA]** Templat Legal Brief Request resmi belum diterima. Kolom di atas diambil dari uraian SOP tahap 2 dan wajib dicocokkan dengan templat resmi sebelum dibangun.

---

## 10. Persetujuan dan perubahan pokok

1. Tabel `persetujuan` ditambah tahap: `atasan`, `seleksi`, `finance`, `pimpinan`, `partnership`, `legal`, dan keputusan `setuju`, `kembalikan`, `tolak`. Tabel tetap hanya INSERT.
2. Kolom baru `kontrak.siklus_persetujuan` (mulai 1) dan `persetujuan.siklus`. Persetujuan hanya sah untuk siklus yang sama.
3. **Kolom pokok:** `counterparty_id`, `ruang_lingkup` dan bagian E, `estimasi_nilai`/`nilai_kontrak`, `rencana_mulai`, `rencana_selesai`, `tanggal_mulai`, `tanggal_berakhir`, `jenis_permintaan`.
4. Setelah T13 (persetujuan pimpinan), kolom pokok **terkunci** untuk semua peran. Perubahan hanya lewat T17 atau T23 yang menaikkan `siklus_persetujuan` dan mengembalikan berkas ke `kajian`. **[TERBUKA]** ambang perubahan nilai yang dianggap pokok (usulan bawaan: setiap perubahan).
5. Persetujuan pimpinan mengikuti **matriks kewenangan** di `pengaturan`: daftar rentang nilai → jabatan/pengguna penyetuju. **[TERBUKA]** isi matriks. Sampai diputuskan, semua pengguna `direksi` boleh menyetujui dan ambang lama `ambang_direksi` tidak lagi dipakai untuk melompati tahap E (SOP: tanpa persetujuan tertulis, tidak diteruskan ke Legal).

---

## 11. SLA dan eskalasi

1. Target per kelompok SLA disimpan di `pengaturan` (tidak di-hardcode). Nilai bawaan dari SOP:

| Kelompok | Target bawaan |
|---|---|
| `seleksi` | 3 hari kerja |
| `kajian_persetujuan` | 5 hari kerja |
| `brief` | 2 hari kerja |
| `cek_kelengkapan` | 1 hari kerja |
| `analisis` | 3 hari kerja |
| `draf` | 5 hari kerja |
| `konfirmasi_final` | 3 hari kerja |
| `atasan`, `konfirmasi_mitra`, `negosiasi`, `ttd` | **[TERBUKA]**, bawaan kosong = tidak dipantau |

2. **Hari kerja** = Senin–Jumat dikurangi tabel baru `hari_libur` (dikelola Legal atau Partnership), zona Asia/Jakarta. **[TERBUKA]** konfirmasi hari kerja (Formulir menyebut "3 hari kerja").
3. **Jam SLA** mulai saat berkas masuk status pertama kelompoknya (dibaca dari `riwayat_status`). Berpindah antar status dalam kelompok yang sama tidak mereset jam.
4. Pengembalian ke kelompok sebelumnya lalu masuk lagi = **jam baru** (P1). Jam lama tetap tercatat untuk laporan.
5. Bidang turunan (tidak disimpan): `masuk_kelompok_pada`, `tenggat_sla`, `hari_kerja_berjalan`, `sisa_hari_kerja`, `status_sla` (`tepat_waktu`, `jatuh_tempo_hari_ini`, `terlambat`). Dihitung di modul logika tunggal yang diuji.
6. **Eskalasi** oleh job harian 07:00 WIB, idempoten lewat tabel baru `eskalasi_sla` (unik per `kontrak_id`, `riwayat_status_id` masuk kelompok, `tingkat`):
   - Tingkat 1, hari jatuh tempo: pengingat ke pemegang berkas.
   - Tingkat 2, terlambat ≥ `eskalasi_hari_tingkat2` (bawaan 1 hari kerja): atasan pemegang berkas (`atasan_id`) atau, bila kosong, `kepala` peran itu.
   - Tingkat 3, terlambat ≥ `eskalasi_hari_tingkat3` (bawaan 3 hari kerja): Head Partnership atau Head Legal (`kepala`).
   - Untuk kelompok milik Unit atau Pimpinan, tingkat 3 dikirim ke Head Partnership.
   - **[TERBUKA]** angka hari tingkat 2 dan 3.
7. Eskalasi masuk ke notifikasi aplikasi dan ringkasan email harian yang sudah ada (satu email per penerima per hari, tanpa nilai).

---

## 12. Dokumen

1. Kategori ditambah: `formulir_usulan` (opsional, bila ada versi tanda tangan basah), `lampiran_usulan`, `nota_kajian`, `bukti_persetujuan`, `legal_brief`, `nda`, `naskah_final`, `salinan_distribusi`. Kategori lama tetap.
2. Syarat lama "minimal satu dokumen `draft` sebelum diajukan ke Legal" **dihapus**. Dokumen `draft` kini dibuat Legal di tahap 5 (T24).
3. Kolom baru di `kontrak`: `lokasi_arsip_asli` (teks, wajib untuk T31/T32), `tanggal_distribusi_salinan`.
4. Hak buka dokumen per kategori: Partnership boleh semua; Unit Pengusul tidak boleh `nota_kajian` dan `bukti_persetujuan` yang memuat nilai bila aturan visibilitas nilai (bagian 2 butir 4) memutuskan demikian.

---

## 13. Migrasi data lama

1. Migrasi skema hanya ditambahkan di akhir daftar `MIGRASI` di `server/db.js`. Migrasi lama tidak diubah.
2. Pemetaan status bawaan (wajib dikonfirmasi Legal sebelum dijalankan di produksi, **[TERBUKA]**):

| Status lama | Status baru | Catatan |
|---|---|---|
| `draft` | `usulan_draft` | Data Formulir kosong; ditandai `data_usulan_belum_lengkap` |
| `review_legal` | `analisis_hukum` | Dianggap sudah lolos persetujuan pimpinan secara manual; ditandai `jalur_lama = ya` |
| `review_finance` | `finalisasi` | Sudah lewat Legal di alur lama; Legal memastikan ulang; `jalur_lama = ya` |
| `persetujuan_direksi` | `finalisasi` | Sama; `jalur_lama = ya` |
| lainnya | tetap | — |

3. Berkas `jalur_lama = ya` dikecualikan dari syarat bukti persetujuan pimpinan di T19 dan dari laporan kepatuhan SLA.
4. Setiap perubahan status karena migrasi dicatat di `riwayat_status` dengan pelaku sistem dan catatan "Migrasi alur SOP".
5. **Jalur inventaris:** kontrak lama yang sudah ditandatangani (inventarisasi data, `CLAUDE.md` bagian 12) dapat dibuat Legal langsung di `menunggu_ttd` dengan `jenis_permintaan = baru` dan `jalur_lama = ya`, lalu diaktifkan lewat T31. Ini satu-satunya pengecualian titik masuk.

---

## 14. Tampilan

1. Detail kontrak menampilkan **garis waktu tahap SOP** (B sampai 8): tahap selesai, tahap berjalan beserta pemegang berkas dan status SLA, tahap berikutnya.
2. Tombol aksi hanya untuk transisi yang sah bagi peran, status, dan penugasan pengguna. Server tetap memeriksa.
3. Dashboard per peran menampilkan antrean "menunggu saya" berurut keterlambatan SLA.
4. Dashboard Partnership: corong usulan (masuk, lolos seleksi, disetujui pimpinan, ditandatangani, ditolak), kepatuhan SLA per kelompok, berkas terlambat.
5. Formulir usulan berupa form bertahap A–H dengan simpan draf, mengikuti urutan dan istilah Formulir.
6. Peringatan P4 tampil di detail selama status sebelum `aktif`: "Belum boleh ditandatangani, menjanjikan nilai, atau dilaksanakan."
7. Peringatan P5 tampil bila `status_nda = belum_ada` dan risiko memuat data sensitif.

---

## 15. Tes wajib

1. Setiap baris T01–T38: transisi sah lulus; pelaku salah ditolak 403; status salah ditolak 409; alasan wajib ditolak bila kosong.
2. Four-eyes di T03, T05, T11, T13, T20, T28.
3. Isolasi divisi untuk `pic` dan `atasan_unit` di semua endpoint baru.
4. Nomor registrasi: unik di bawah permintaan bersamaan, urut per tahun, tidak berubah.
5. Siklus persetujuan: persetujuan siklus lama tidak sah setelah T17/T23; kolom pokok terkunci setelah T13.
6. SLA: batas hari kerja (Jumat → Senin, hari libur, tengah malam WIB), reset jam setelah pengembalian, kelompok gabungan tidak mereset.
7. Eskalasi: job dua kali tidak mengirim ganda; tingkat naik sesuai hari; penerima benar.
8. Berkas anak: efek perpanjangan, addendum, pengakhiran pada induk dalam satu transaksi; induk kembali `aktif` bila anak ditolak.
9. Migrasi: pemetaan status lama benar dan tercatat di riwayat.
10. Data uji fiktif saja.
