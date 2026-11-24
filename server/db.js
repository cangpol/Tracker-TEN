import pg from 'pg';

const { Pool, types } = pg;

// Tanggal dan uang dikembalikan sebagai string agar tidak bergeser zona waktu / kehilangan presisi (ATURAN bagian 4-5).
const DATE = 1082; const NUMERIC = 1700;
const parser = { getTypeParser: (oid, fmt) => (oid === DATE || oid === NUMERIC ? (v) => v : types.getTypeParser(oid, fmt)) };

const bungkus = (jalankan) => ({
  /** Semua baris. */
  q: async (sql, params) => (await jalankan(sql, params)).rows,
  /** Satu baris atau null. */
  satu: async (sql, params) => (await jalankan(sql, params)).rows[0] ?? null,
  /** Hasil mentah (rowCount dll). */
  jalankan,
});

/**
 * Pool PostgreSQL. Di Vercel gunakan URL "pooled" (Neon/Supabase) dan pool kecil per instance.
 * `skema` hanya untuk tes (isolasi per berkas tes).
 */
export function bukaDb({ url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL, skema } = {}) {
  if (!url) throw new Error('DATABASE_URL belum diatur.');
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX) || (process.env.VERCEL ? 3 : 10),
    idleTimeoutMillis: 10_000,
    types: parser,
    ...(skema ? { options: `-c search_path=${skema}` } : {}),
  });
  pool.on('error', (e) => console.error('pool db:', e.message)); // koneksi idle putus: jangan matikan proses
  const dasar = bungkus((sql, params) => pool.query(sql, params));
  return {
    ...dasar,
    /** Transaksi: `fn` menerima objek {q, satu, jalankan} yang terikat ke satu koneksi. */
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const hasil = await fn(bungkus((sql, params) => c.query(sql, params)));
        await c.query('COMMIT');
        return hasil;
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        c.release();
      }
    },
    tutup: () => pool.end(),
  };
}

const JENIS = "'MoU','PKS','NDA','SPK','kontrak_vendor'";
const STATUS = "'draft','review_legal','review_finance','persetujuan_direksi','menunggu_ttd','aktif','negosiasi_perpanjangan','berakhir','diputus','dibatalkan','arsip'";
const PERAN = "'admin_sistem','legal','pic','finance','direksi','viewer'";

// Migrasi bertahap, hanya ditambah di akhir. Jangan mengubah migrasi yang sudah dijalankan di produksi.
const MIGRASI = [
  {
    id: 1,
    sql: `
CREATE TABLE divisi (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode text NOT NULL UNIQUE, nama text NOT NULL, aktif boolean NOT NULL DEFAULT true
);
CREATE TABLE pengguna (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama text NOT NULL, email text NOT NULL UNIQUE, sandi_hash text NOT NULL,
  aktif boolean NOT NULL DEFAULT true,
  peran text NOT NULL DEFAULT 'viewer' CHECK (peran IN (${PERAN})),
  divisi_id integer REFERENCES divisi(id),
  wajib_ganti boolean NOT NULL DEFAULT false,
  demo boolean NOT NULL DEFAULT false,
  terakhir_login timestamptz
);
CREATE TABLE permintaan_peran (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pengguna_id integer NOT NULL REFERENCES pengguna(id),
  peran_lama text, peran_baru text NOT NULL,
  diminta_oleh integer NOT NULL REFERENCES pengguna(id), waktu timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','disetujui','ditolak')),
  diputuskan_oleh integer REFERENCES pengguna(id), waktu_putus timestamptz
);
CREATE TABLE counterparty (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama text NOT NULL, nama_normal text NOT NULL UNIQUE
);
CREATE TABLE kontrak (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nomor_kontrak text,
  judul text NOT NULL,
  jenis_dokumen text NOT NULL CHECK (jenis_dokumen IN (${JENIS})),
  ruang_lingkup text,
  counterparty_id integer NOT NULL REFERENCES counterparty(id),
  divisi_id integer NOT NULL REFERENCES divisi(id),
  pic_nama text NOT NULL,
  tanggal_ttd date, tanggal_mulai date, tanggal_berakhir date,
  perpanjangan_otomatis boolean NOT NULL DEFAULT false,
  masa_pemberitahuan_hari integer NOT NULL DEFAULT 0 CHECK (masa_pemberitahuan_hari >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (${STATUS})),
  siklus_perpanjangan integer NOT NULL DEFAULT 0,
  tingkat_risiko text NOT NULL DEFAULT 'sedang' CHECK (tingkat_risiko IN ('rendah','sedang','tinggi')),
  nilai_kontrak numeric(18,2) CHECK (nilai_kontrak IS NULL OR nilai_kontrak >= 0),
  mata_uang char(3) NOT NULL DEFAULT 'IDR',
  jenis_kontrak text NOT NULL DEFAULT 'non_finansial' CHECK (jenis_kontrak IN ('pendapatan','pengeluaran','non_finansial')),
  skema_pembayaran text,
  catatan text,
  dibuat_oleh integer REFERENCES pengguna(id),
  dibuat_pada timestamptz NOT NULL DEFAULT now(), diubah_pada timestamptz NOT NULL DEFAULT now(),
  diarsipkan_pada timestamptz,
  CHECK (tanggal_berakhir IS NULL OR tanggal_mulai IS NULL OR tanggal_berakhir > tanggal_mulai)
);
CREATE UNIQUE INDEX ux_kontrak_nomor ON kontrak(nomor_kontrak) WHERE nomor_kontrak IS NOT NULL;
CREATE INDEX ix_kontrak_status ON kontrak(status);
CREATE INDEX ix_kontrak_berakhir ON kontrak(tanggal_berakhir);
CREATE INDEX ix_kontrak_divisi ON kontrak(divisi_id);
CREATE TABLE dokumen (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kontrak_id integer NOT NULL REFERENCES kontrak(id),
  kategori text NOT NULL CHECK (kategori IN ('draft','final_ttd','adendum','laporan','bukti_lain')),
  nama text NOT NULL, lokasi text NOT NULL, versi integer NOT NULL,
  diunggah_oleh integer REFERENCES pengguna(id), diunggah_pada timestamptz NOT NULL DEFAULT now(),
  diarsipkan_pada timestamptz,
  UNIQUE (kontrak_id, kategori, versi)
);
CREATE TABLE riwayat_status (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kontrak_id integer NOT NULL REFERENCES kontrak(id),
  status_lama text, status_baru text NOT NULL, pelaku_id integer REFERENCES pengguna(id),
  waktu timestamptz NOT NULL DEFAULT now(), catatan text
);
CREATE TABLE persetujuan (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kontrak_id integer NOT NULL REFERENCES kontrak(id),
  tahap text NOT NULL CHECK (tahap IN ('legal','finance','direksi')),
  pemberi_id integer NOT NULL REFERENCES pengguna(id),
  keputusan text NOT NULL CHECK (keputusan IN ('setuju','kembalikan')),
  waktu timestamptz NOT NULL DEFAULT now(), catatan text
);
CREATE TABLE perpanjangan (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kontrak_id integer NOT NULL REFERENCES kontrak(id), siklus integer NOT NULL,
  tanggal_berakhir_lama date NOT NULL, tanggal_berakhir_baru date NOT NULL,
  dicatat_oleh integer REFERENCES pengguna(id), waktu timestamptz NOT NULL DEFAULT now(), catatan text
);
CREATE TABLE aturan_reminder (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  acuan text NOT NULL CHECK (acuan IN ('berakhir','notice')),
  hari_sebelum integer NOT NULL CHECK (hari_sebelum > 0),
  peran_penerima text NOT NULL CHECK (peran_penerima IN ('pic','legal','direksi')),
  aktif boolean NOT NULL DEFAULT true
);
CREATE TABLE pengiriman_notifikasi (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kontrak_id integer NOT NULL REFERENCES kontrak(id),
  aturan_id integer NOT NULL REFERENCES aturan_reminder(id),
  siklus integer NOT NULL, penerima_id integer NOT NULL REFERENCES pengguna(id),
  kanal text NOT NULL CHECK (kanal IN ('app','email')),
  status text NOT NULL CHECK (status IN ('terkirim','gagal','dilewati')),
  percobaan integer NOT NULL DEFAULT 1, dikirim_pada timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kontrak_id, aturan_id, siklus, penerima_id, kanal)
);
CREATE TABLE notifikasi_app (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  penerima_id integer NOT NULL REFERENCES pengguna(id),
  kontrak_id integer REFERENCES kontrak(id),
  jenis text NOT NULL, pesan text NOT NULL,
  dibaca_pada timestamptz, dibuat_pada timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notifikasi_penerima ON notifikasi_app(penerima_id, dibaca_pada);
CREATE TABLE audit_log (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  waktu timestamptz NOT NULL DEFAULT now(), pelaku_id integer, ip text,
  aksi text NOT NULL, objek_tabel text, objek_id integer, ringkasan text
);
CREATE INDEX ix_audit_aksi ON audit_log(aksi, id DESC);
CREATE TABLE pengaturan (kunci text PRIMARY KEY, nilai text NOT NULL);
CREATE TABLE sesi (sid text PRIMARY KEY, data jsonb NOT NULL, kedaluwarsa timestamptz NOT NULL);
CREATE INDEX ix_sesi_kedaluwarsa ON sesi(kedaluwarsa);

-- Hanya tambah (ATURAN bagian 4).
CREATE FUNCTION tolak_ubah() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'tabel % hanya boleh ditambah', TG_TABLE_NAME; END $$;
CREATE TRIGGER ro_riwayat_status BEFORE UPDATE OR DELETE ON riwayat_status FOR EACH ROW EXECUTE FUNCTION tolak_ubah();
CREATE TRIGGER ro_persetujuan BEFORE UPDATE OR DELETE ON persetujuan FOR EACH ROW EXECUTE FUNCTION tolak_ubah();
CREATE TRIGGER ro_audit_log BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION tolak_ubah();

INSERT INTO divisi (kode, nama) VALUES ('BD','Business Development'),('OPS','Operasional'),('AKD','Akademik'),('LGL','Legal'),('FIN','Finance');
INSERT INTO pengaturan (kunci, nilai) VALUES
  ('batas_kuning_hari','180'), ('batas_oranye_hari','90'),
  ('ambang_direksi','0'),
  ('domain_tautan_diizinkan','drive.google.com,docs.google.com,onedrive.live.com,sharepoint.com');
INSERT INTO aturan_reminder (acuan, hari_sebelum, peran_penerima) VALUES
  ('berakhir',120,'pic'),
  ('berakhir',60,'pic'),('berakhir',60,'legal'),
  ('berakhir',30,'pic'),('berakhir',30,'legal'),('berakhir',30,'direksi'),
  ('berakhir',7,'pic'),('berakhir',7,'legal'),('berakhir',7,'direksi'),
  ('notice',30,'pic'),('notice',30,'legal'),
  ('notice',7,'pic'),('notice',7,'legal'),('notice',7,'direksi');
`,
  },
  {
    id: 2,
    // Unit bisnis grup: tiap unit punya akun PIC yang hanya melihat kontrak unitnya.
    sql: `INSERT INTO divisi (kode, nama) VALUES ('TTL','Tgn & Tlc'),('UPT','Upitra'),('CRS','Cristore') ON CONFLICT (kode) DO NOTHING;`,
  },
];

/** Jalankan migrasi yang belum ada. Aman dipanggil bersamaan dari banyak instance (kunci advisory). */
export async function migrasi(db) {
  await db.tx(async (t) => {
    await t.jalankan('SELECT pg_advisory_xact_lock(727001)');
    await t.jalankan('CREATE TABLE IF NOT EXISTS migrasi (id integer PRIMARY KEY, waktu timestamptz NOT NULL DEFAULT now())');
    const sudah = new Set((await t.q('SELECT id FROM migrasi')).map((r) => r.id));
    for (const m of MIGRASI.filter((x) => !sudah.has(x.id))) {
      await t.jalankan(m.sql);
      await t.jalankan('INSERT INTO migrasi (id) VALUES ($1)', [m.id]);
    }
  });
}

export const sekarangIso = () => new Date().toISOString();
