// Data demo FIKTIF. Tanggal relatif terhadap hari ini agar dashboard selalu berisi. Tidak ada data asli (CLAUDE.md bagian 14).
import { randomBytes } from 'node:crypto';
import { hariIni, tambahHari } from './logika.js';
import { hashSandi } from './sandi.js';

const AKUN = [
  ['Admin Sistem Demo', 'sistem@demo.test', 'admin_sistem', null],
  ['Legal Demo', 'legal@demo.test', 'legal', null],
  ['Legal Kedua Demo', 'legal2@demo.test', 'legal', null],
  ['PIC Akademik Demo', 'pic@demo.test', 'pic', 'AKD'],
  ['Finance Demo', 'finance@demo.test', 'finance', null],
  ['Direksi Demo', 'direksi@demo.test', 'direksi', null],
  ['Auditor Demo', 'viewer@demo.test', 'viewer', null],
];

// [judul, jenis, pihak, divisi, pic, sisaHari, notice, auto-renew, status, nilai, jenis kontrak, risiko]
const DATA = [
  ['Kerja sama praktik kerja siswa', 'MoU', 'SMK Nusa Cendana (fiktif)', 'AKD', 'Dewi Larasati', 12, 30, false, 'aktif', null, 'non_finansial', 'rendah'],
  ['Pelatihan guru semester genap', 'PKS', 'Yayasan Pelita Ilmu (fiktif)', 'AKD', 'Bimo Anggara', 45, 60, true, 'aktif', '85000000', 'pendapatan', 'sedang'],
  ['Kemitraan magang industri', 'MoU', 'PT Karya Samudra Fiktif', 'BD', 'Rani Puspita', 75, 30, false, 'negosiasi_perpanjangan', null, 'non_finansial', 'sedang'],
  ['Pengadaan platform belajar', 'kontrak_vendor', 'CV Digita Mandiri (fiktif)', 'OPS', 'Galih Prakoso', 130, 60, false, 'aktif', '240000000', 'pengeluaran', 'tinggi'],
  ['Perjanjian kerahasiaan program beasiswa', 'NDA', 'Institut Cakrawala Fiktif', 'LGL', 'Sinta Maharani', 230, 0, false, 'aktif', null, 'non_finansial', 'rendah'],
  ['Kerja sama akreditasi program', 'MoU', 'Dinas Pendidikan Kota Fiktif', 'BD', 'Rani Puspita', 400, 90, false, 'aktif', null, 'non_finansial', 'sedang'],
  ['Layanan katering asrama', 'SPK', 'PT Boga Sejahtera Fiktif', 'OPS', 'Galih Prakoso', -20, 0, false, 'berakhir', '36000000', 'pengeluaran', 'rendah'],
  ['Kerja sama riset bersama', 'MoU', 'Universitas Fiktif Nusantara', 'AKD', 'Dewi Larasati', -3, 30, true, 'aktif', null, 'non_finansial', 'sedang'],
  ['Penyusunan kurikulum vokasi', 'PKS', 'SMK Bina Mandiri (fiktif)', 'AKD', 'Bimo Anggara', null, 0, false, 'review_legal', '120000000', 'pendapatan', 'sedang'],
  ['Rencana kolaborasi pelatihan', 'MoU', 'Lembaga Mitra Fiktif', 'BD', 'Rani Puspita', null, 0, false, 'draft', null, 'non_finansial', 'rendah'],
  ['Lisensi aplikasi manajemen sekolah', 'kontrak_vendor', 'PT Aksara Digital Fiktif', 'OPS', 'Galih Prakoso', null, 0, false, 'review_finance', '180000000', 'pengeluaran', 'sedang'],
  ['Kemitraan beasiswa nasional', 'MoU', 'Yayasan Cahaya Bangsa Fiktif', 'BD', 'Rani Puspita', null, 0, false, 'persetujuan_direksi', '950000000', 'pendapatan', 'tinggi'],
  ['Kerja sama pusat pelatihan guru', 'PKS', 'SMK Garuda Fiktif', 'AKD', 'Dewi Larasati', null, 0, false, 'menunggu_ttd', '60000000', 'pendapatan', 'rendah'],
];

// Persetujuan yang sudah tercatat menurut tahap saat ini.
const SUDAH_SETUJU = {
  review_finance: ['legal'], persetujuan_direksi: ['legal', 'finance'], menunggu_ttd: ['legal', 'finance'],
};
const BELUM_ADA_DRAFT = new Set(['Rencana kolaborasi pelatihan']);

/** Isi data demo. `t` = db atau transaksi. Idempoten terhadap akun: lewati bila akun demo sudah ada. */
export async function isiDemo(t) {
  if (await t.satu('SELECT 1 FROM pengguna WHERE demo LIMIT 1')) return false;
  const divisi = Object.fromEntries((await t.q('SELECT kode, id FROM divisi')).map((d) => [d.kode, d.id]));
  const pengguna = {};
  for (const [nama, email, peran, kd] of AKUN) {
    // Akun demo hanya bisa dimasuki lewat tombol demo: kata sandinya acak dan tidak pernah ditampilkan.
    pengguna[email] = (await t.satu('INSERT INTO pengguna (nama, email, sandi_hash, peran, divisi_id, demo) VALUES ($1,$2,$3,$4,$5,true) ON CONFLICT (email) DO NOTHING RETURNING id',
      [nama, email, hashSandi(randomBytes(24).toString('hex')), peran, kd ? divisi[kd] : null]))?.id;
  }
  const penyetuju = { legal: pengguna['legal@demo.test'], finance: pengguna['finance@demo.test'], direksi: pengguna['direksi@demo.test'] };
  const h = hariIni();
  let no = 1;
  for (const [judul, jenis, pihak, kd, pic, sisa, notice, otomatis, status, nilai, jk, risiko] of DATA) {
    const normal = pihak.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const cp = (await t.satu('INSERT INTO counterparty (nama, nama_normal) VALUES ($1,$2) ON CONFLICT (nama_normal) DO UPDATE SET nama = counterparty.nama RETURNING id', [pihak, normal])).id;
    const berjalan = sisa !== null;
    const berakhir = berjalan ? tambahHari(h, sisa) : null;
    const mulai = berjalan ? tambahHari(berakhir, -365) : null;
    const bernomor = berjalan || status === 'menunggu_ttd';
    const k = await t.satu(`INSERT INTO kontrak (nomor_kontrak, judul, jenis_dokumen, ruang_lingkup, counterparty_id, divisi_id, pic_nama,
      tanggal_ttd, tanggal_mulai, tanggal_berakhir, perpanjangan_otomatis, masa_pemberitahuan_hari, status, tingkat_risiko, nilai_kontrak, jenis_kontrak)
      VALUES ($1,$2,$3,'Data contoh fiktif untuk demonstrasi.',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [bernomor ? `DEMO/${String(no).padStart(3, '0')}/2026` : null, judul, jenis, cp, divisi[kd], pic, mulai, mulai, berakhir, otomatis, notice, status, risiko, nilai, jk]);
    await t.jalankan("INSERT INTO riwayat_status (kontrak_id, status_lama, status_baru, catatan) VALUES ($1,NULL,$2,'Data contoh')", [k.id, status]);
    if (!BELUM_ADA_DRAFT.has(judul)) {
      await t.jalankan("INSERT INTO dokumen (kontrak_id, kategori, nama, lokasi, versi) VALUES ($1,'draft','Draf kontrak v1','https://drive.google.com/contoh-fiktif/draf',1)", [k.id]);
    } else {
      await t.jalankan("INSERT INTO dokumen (kontrak_id, kategori, nama, lokasi, versi) VALUES ($1,'draft','Draf awal','https://drive.google.com/contoh-fiktif/draf-awal',1)", [k.id]);
    }
    if (berjalan) {
      await t.jalankan("INSERT INTO dokumen (kontrak_id, kategori, nama, lokasi, versi) VALUES ($1,'final_ttd','Dokumen final bertanda tangan','https://drive.google.com/contoh-fiktif/final',1)", [k.id]);
    }
    for (const tahap of SUDAH_SETUJU[status] ?? []) {
      await t.jalankan("INSERT INTO persetujuan (kontrak_id, tahap, pemberi_id, keputusan, catatan) VALUES ($1,$2,$3,'setuju','Data contoh')", [k.id, tahap, penyetuju[tahap]]);
    }
    no++;
  }
  return true;
}
