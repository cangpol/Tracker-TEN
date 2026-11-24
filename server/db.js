import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { STATUS } from './logika.js';

const SKEMA = `
CREATE TABLE IF NOT EXISTS pengguna (
  id INTEGER PRIMARY KEY, nama TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  sandi_hash TEXT NOT NULL, aktif INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS divisi (
  id INTEGER PRIMARY KEY, kode TEXT NOT NULL UNIQUE, nama TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS counterparty (
  id INTEGER PRIMARY KEY, nama TEXT NOT NULL, nama_normal TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS kontrak (
  id INTEGER PRIMARY KEY,
  nomor_kontrak TEXT,
  judul TEXT NOT NULL,
  jenis_dokumen TEXT NOT NULL CHECK (jenis_dokumen IN ('MoU','PKS','NDA','SPK','kontrak_vendor')),
  ruang_lingkup TEXT,
  counterparty_id INTEGER NOT NULL REFERENCES counterparty(id),
  divisi_id INTEGER NOT NULL REFERENCES divisi(id),
  pic_nama TEXT NOT NULL,
  tanggal_ttd TEXT, tanggal_mulai TEXT, tanggal_berakhir TEXT,
  perpanjangan_otomatis INTEGER NOT NULL DEFAULT 0,
  masa_pemberitahuan_hari INTEGER NOT NULL DEFAULT 0 CHECK (masa_pemberitahuan_hari >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (${STATUS.map((s) => `'${s}'`).join(',')})),
  siklus_perpanjangan INTEGER NOT NULL DEFAULT 0,
  tingkat_risiko TEXT NOT NULL DEFAULT 'sedang' CHECK (tingkat_risiko IN ('rendah','sedang','tinggi')),
  tautan_dokumen_final TEXT,
  catatan TEXT,
  dibuat_pada TEXT NOT NULL, diubah_pada TEXT NOT NULL, diarsipkan_pada TEXT,
  CHECK (tanggal_berakhir IS NULL OR tanggal_mulai IS NULL OR tanggal_berakhir > tanggal_mulai)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_kontrak_nomor ON kontrak(nomor_kontrak) WHERE nomor_kontrak IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_kontrak_status ON kontrak(status);
CREATE INDEX IF NOT EXISTS ix_kontrak_berakhir ON kontrak(tanggal_berakhir);
CREATE TABLE IF NOT EXISTS riwayat_status (
  id INTEGER PRIMARY KEY, kontrak_id INTEGER NOT NULL REFERENCES kontrak(id),
  status_lama TEXT, status_baru TEXT NOT NULL, pelaku_id INTEGER, waktu TEXT NOT NULL, catatan TEXT
);
CREATE TABLE IF NOT EXISTS perpanjangan (
  id INTEGER PRIMARY KEY, kontrak_id INTEGER NOT NULL REFERENCES kontrak(id), siklus INTEGER NOT NULL,
  tanggal_berakhir_lama TEXT NOT NULL, tanggal_berakhir_baru TEXT NOT NULL,
  dicatat_oleh INTEGER, waktu TEXT NOT NULL, catatan TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY, waktu TEXT NOT NULL, pelaku_id INTEGER, ip TEXT,
  aksi TEXT NOT NULL, objek_tabel TEXT, objek_id INTEGER, ringkasan TEXT
);
CREATE TABLE IF NOT EXISTS pengaturan (kunci TEXT PRIMARY KEY, nilai TEXT NOT NULL);
-- Hanya tambah (ATURAN bagian 4).
CREATE TRIGGER IF NOT EXISTS riwayat_status_ro_u BEFORE UPDATE ON riwayat_status BEGIN SELECT RAISE(ABORT,'append-only'); END;
CREATE TRIGGER IF NOT EXISTS riwayat_status_ro_d BEFORE DELETE ON riwayat_status BEGIN SELECT RAISE(ABORT,'append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_log_ro_u BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT,'append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_log_ro_d BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT,'append-only'); END;
`;

const DIVISI_AWAL = [['BD', 'Business Development'], ['OPS', 'Operasional'], ['AKD', 'Akademik'], ['LGL', 'Legal'], ['FIN', 'Finance']];

export function bukaDb(path = process.env.DB_PATH || 'data/simou.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SKEMA);
  const tambah = db.prepare('INSERT OR IGNORE INTO divisi (kode, nama) VALUES (?, ?)');
  for (const [kode, nama] of DIVISI_AWAL) tambah.run(kode, nama);
  db.prepare("INSERT OR IGNORE INTO pengaturan VALUES ('batas_kuning_hari','180'),('batas_oranye_hari','90')").run();
  return db;
}

export function transaksi(db, fn) {
  db.exec('BEGIN');
  try {
    const hasil = fn();
    db.exec('COMMIT');
    return hasil;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const sekarangIso = () => new Date().toISOString();
