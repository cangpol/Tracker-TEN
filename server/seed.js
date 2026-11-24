// Data contoh FIKTIF untuk demo. Tanggal relatif terhadap hari ini agar dashboard selalu berisi.
import { bukaDb } from './db.js';
import { hariIni, tambahHari } from './logika.js';

const db = bukaDb();
const h = hariIni();
const divisi = Object.fromEntries(db.prepare('SELECT kode, id FROM divisi').all().map((d) => [d.kode, d.id]));
const w = new Date().toISOString();

// [judul, jenis, pihak, divisi, pic, sisaHari, notice, otomatis, status]
const DATA = [
  ['Kerja sama praktik kerja siswa', 'MoU', 'SMK Nusa Cendana (fiktif)', 'AKD', 'Dewi Larasati', 12, 30, 0, 'aktif'],
  ['Pelatihan guru semester genap', 'PKS', 'Yayasan Pelita Ilmu (fiktif)', 'AKD', 'Bimo Anggara', 45, 60, 1, 'aktif'],
  ['Kemitraan magang industri', 'MoU', 'PT Karya Samudra Fiktif', 'BD', 'Rani Puspita', 75, 30, 0, 'negosiasi_perpanjangan'],
  ['Pengadaan platform belajar', 'kontrak_vendor', 'CV Digita Mandiri (fiktif)', 'OPS', 'Galih Prakoso', 130, 60, 0, 'aktif'],
  ['Perjanjian kerahasiaan program beasiswa', 'NDA', 'Institut Cakrawala Fiktif', 'LGL', 'Sinta Maharani', 230, 0, 0, 'aktif'],
  ['Kerja sama akreditasi program', 'MoU', 'Dinas Pendidikan Kota Fiktif', 'BD', 'Rani Puspita', 400, 90, 0, 'aktif'],
  ['Layanan katering asrama', 'SPK', 'PT Boga Sejahtera Fiktif', 'OPS', 'Galih Prakoso', -20, 0, 0, 'berakhir'],
  ['Kerja sama riset bersama', 'MoU', 'Universitas Fiktif Nusantara', 'AKD', 'Dewi Larasati', -3, 30, 1, 'aktif'],
  ['Penyusunan kurikulum vokasi', 'PKS', 'SMK Bina Mandiri (fiktif)', 'AKD', 'Bimo Anggara', null, 0, 0, 'review_legal'],
  ['Rencana kolaborasi pelatihan', 'MoU', 'Lembaga Mitra Fiktif', 'BD', 'Rani Puspita', null, 0, 0, 'draft'],
];

if (db.prepare('SELECT 1 FROM kontrak LIMIT 1').get()) {
  console.log('Tabel kontrak sudah berisi data. Seed dibatalkan.');
  process.exit(0);
}

let no = 1;
for (const [judul, jenis, pihak, kd, pic, sisa, notice, otomatis, status] of DATA) {
  const normal = pihak.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  db.prepare('INSERT OR IGNORE INTO counterparty (nama, nama_normal) VALUES (?, ?)').run(pihak, normal);
  const cp = db.prepare('SELECT id FROM counterparty WHERE nama_normal = ?').get(normal).id;
  const aktif = sisa !== null;
  const berakhir = aktif ? tambahHari(h, sisa) : null;
  const mulai = aktif ? tambahHari(berakhir, -365) : null;
  const r = db.prepare(`INSERT INTO kontrak (nomor_kontrak, judul, jenis_dokumen, ruang_lingkup, counterparty_id, divisi_id, pic_nama,
    tanggal_ttd, tanggal_mulai, tanggal_berakhir, perpanjangan_otomatis, masa_pemberitahuan_hari, status, tautan_dokumen_final,
    dibuat_pada, diubah_pada) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(aktif ? `DEMO/${String(no).padStart(3, '0')}/2026` : null, judul, jenis, 'Data contoh fiktif', cp, divisi[kd], pic,
      mulai, mulai, berakhir, otomatis, notice, status, aktif ? 'https://contoh.example/dokumen-final' : null, w, w);
  db.prepare('INSERT INTO riwayat_status (kontrak_id, status_lama, status_baru, waktu, catatan) VALUES (?,?,?,?,?)')
    .run(r.lastInsertRowid, null, status, w, 'Data contoh');
  no++;
}
console.log(`${DATA.length} kontrak contoh (fiktif) ditambahkan.`);
