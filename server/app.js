import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { transaksi, sekarangIso } from './db.js';
import { cocokSandi, HASH_PALSU } from './sandi.js';
import { hitung, cekTransisi, hariIni, TRANSISI, selisihHari, harusBerakhir, rentang } from './logika.js';

const JENIS = ['MoU', 'PKS', 'NDA', 'SPK', 'kontrak_vendor'];
const RISIKO = ['rendah', 'sedang', 'tinggi'];
const TEKS = { nomor_kontrak: 100, judul: 255, ruang_lingkup: 5000, pic_nama: 150, catatan: 5000 };
const TANGGAL = ['tanggal_ttd', 'tanggal_mulai', 'tanggal_berakhir'];
const TANGGAL_RE = /^\d{4}-\d{2}-\d{2}$/;

class Galat extends Error {
  constructor(status, kode, pesan) { super(pesan); this.status = status; this.kode = kode; }
}
const tolak = (pesan, status = 400, kode = 'tidak_valid') => { throw new Galat(status, kode, pesan); };

const tanggalSah = (t) => TANGGAL_RE.test(t) && !Number.isNaN(Date.parse(t)) && new Date(t).toISOString().slice(0, 10) === t;

/** Saring dan validasi input kontrak. Hanya kolom yang diizinkan yang lolos. */
function bersihkan(b, penuh) {
  const o = {};
  for (const [f, maks] of Object.entries(TEKS)) {
    if (b[f] === undefined) continue;
    const v = b[f] === null ? '' : String(b[f]).trim();
    if (v.length > maks) tolak(`Kolom ${f} terlalu panjang (maks ${maks} karakter).`);
    o[f] = v || null;
  }
  if (b.jenis_dokumen !== undefined) {
    if (!JENIS.includes(b.jenis_dokumen)) tolak('Jenis dokumen tidak valid.');
    o.jenis_dokumen = b.jenis_dokumen;
  }
  if (b.tingkat_risiko !== undefined) {
    if (!RISIKO.includes(b.tingkat_risiko)) tolak('Tingkat risiko tidak valid.');
    o.tingkat_risiko = b.tingkat_risiko;
  }
  for (const f of TANGGAL) {
    if (b[f] === undefined) continue;
    if (b[f] === null || b[f] === '') o[f] = null;
    else if (tanggalSah(b[f])) o[f] = b[f];
    else tolak(`Tanggal ${f} harus berformat YYYY-MM-DD.`);
  }
  if (b.masa_pemberitahuan_hari !== undefined) {
    const n = Number(b.masa_pemberitahuan_hari);
    if (!Number.isInteger(n) || n < 0 || n > 3650) tolak('Masa pemberitahuan harus bilangan bulat 0–3650 hari.');
    o.masa_pemberitahuan_hari = n;
  }
  if (b.perpanjangan_otomatis !== undefined) o.perpanjangan_otomatis = b.perpanjangan_otomatis ? 1 : 0;
  if (b.divisi_id !== undefined) {
    const n = Number(b.divisi_id);
    if (!Number.isInteger(n)) tolak('Divisi tidak valid.');
    o.divisi_id = n;
  }
  if (b.tautan_dokumen_final !== undefined) {
    const v = String(b.tautan_dokumen_final ?? '').trim();
    if (v) {
      let u;
      try { u = new URL(v); } catch { tolak('Tautan dokumen tidak valid.'); }
      if (u.protocol !== 'https:' || v.length > 2048) tolak('Tautan dokumen harus berupa URL https.');
    }
    o.tautan_dokumen_final = v || null;
  }
  if (b.counterparty_nama !== undefined) {
    const v = String(b.counterparty_nama).trim();
    if (!v || v.length > 200) tolak('Nama counterparty wajib diisi (maks 200 karakter).');
    o.counterparty_nama = v;
  }
  if (penuh) {
    for (const f of ['judul', 'jenis_dokumen', 'divisi_id', 'pic_nama', 'counterparty_nama']) {
      if (!o[f]) tolak(`Kolom ${f} wajib diisi.`);
    }
  }
  for (const f of ['judul', 'pic_nama']) if (f in o && !o[f]) tolak(`Kolom ${f} wajib diisi.`);
  return o;
}

export function buatApp(db) {
  const app = express();
  const produksi = process.env.NODE_ENV === 'production';
  if (produksi && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET wajib diisi di produksi.');

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  // shortcut: MemoryStore, sesi hilang saat restart; ganti ke store persisten bila multi-instance.
  app.use(session({
    name: 'simou.sid',
    secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', secure: produksi, maxAge: 8 * 3600 * 1000 },
  }));

  const catat = (req, aksi, tabel = null, id = null, ringkasan = null) =>
    db.prepare('INSERT INTO audit_log (waktu, pelaku_id, ip, aksi, objek_tabel, objek_id, ringkasan) VALUES (?,?,?,?,?,?,?)')
      .run(sekarangIso(), req.session?.penggunaId ?? null, req.ip, aksi, tabel, id, ringkasan);

  const ambang = () => {
    const baris = Object.fromEntries(db.prepare('SELECT kunci, nilai FROM pengaturan').all().map((r) => [r.kunci, Number(r.nilai)]));
    return { kuning: baris.batas_kuning_hari, oranye: baris.batas_oranye_hari };
  };
  const SELECT_KONTRAK = `SELECT k.*, c.nama AS counterparty_nama, d.nama AS divisi_nama
    FROM kontrak k JOIN counterparty c ON c.id = k.counterparty_id JOIN divisi d ON d.id = k.divisi_id`;
  const perkaya = (k, hari, amb) => ({ ...k, ...hitung(k, hari, amb) });
  const semuaAktifData = () => {
    const hari = hariIni(); const amb = ambang();
    return db.prepare(`${SELECT_KONTRAK} WHERE k.diarsipkan_pada IS NULL`).all().map((k) => perkaya(k, hari, amb));
  };
  const ambilKontrak = (id) => {
    const k = db.prepare(`${SELECT_KONTRAK} WHERE k.id = ?`).get(Number(id));
    if (!k || k.diarsipkan_pada) tolak('Kontrak tidak ditemukan.', 404, 'tidak_ditemukan');
    return k;
  };
  const cariCounterparty = (nama) => {
    const normal = nama.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const ada = db.prepare('SELECT id FROM counterparty WHERE nama_normal = ?').get(normal);
    return ada ? ada.id : Number(db.prepare('INSERT INTO counterparty (nama, nama_normal) VALUES (?, ?)').run(nama, normal).lastInsertRowid);
  };
  const jalankan = (fn) => (req, res, next) => { try { fn(req, res); } catch (e) { next(e); } };

  // ---------- Auth ----------
  const api = express.Router();
  const batasLogin = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ kode: 'terlalu_banyak', pesan: 'Terlalu banyak percobaan. Coba lagi nanti.' }),
  });
  api.post('/auth/login', batasLogin, jalankan((req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const sandi = String(req.body?.sandi ?? '');
    const p = db.prepare('SELECT * FROM pengguna WHERE email = ? AND aktif = 1').get(email);
    const ok = cocokSandi(sandi, p ? p.sandi_hash : HASH_PALSU) && p;
    if (!ok) {
      catat(req, 'login_gagal', 'pengguna', null, null);
      return res.status(401).json({ kode: 'login_gagal', pesan: 'Email atau kata sandi salah.' });
    }
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ kode: 'galat', pesan: 'Terjadi kesalahan pada server.' });
      req.session.penggunaId = p.id;
      catat(req, 'login', 'pengguna', p.id);
      res.json({ id: p.id, nama: p.nama, email: p.email });
    });
  }));
  api.post('/auth/logout', (req, res) => {
    catat(req, 'logout');
    req.session.destroy(() => res.clearCookie('simou.sid').json({ ok: true }));
  });

  api.use((req, res, next) => {
    if (!req.session.penggunaId) return res.status(401).json({ kode: 'belum_login', pesan: 'Silakan login terlebih dahulu.' });
    next();
  });
  api.get('/auth/saya', (req, res) => {
    res.json(db.prepare('SELECT id, nama, email FROM pengguna WHERE id = ?').get(req.session.penggunaId));
  });

  api.get('/master', (_req, res) => {
    res.json({
      divisi: db.prepare('SELECT id, kode, nama FROM divisi ORDER BY nama').all(),
      counterparty: db.prepare('SELECT nama FROM counterparty ORDER BY nama').all().map((r) => r.nama),
      jenis_dokumen: JENIS,
      tingkat_risiko: RISIKO,
    });
  });

  // ---------- Kontrak ----------
  api.get('/kontrak', jalankan((req, res) => {
    const { q = '', status = '', divisi_id = '', tingkat = '', urut = 'sisa_hari', jenis = '', rentang: rt = '', perlu = '' } = req.query;
    const halaman = Math.max(1, parseInt(req.query.halaman, 10) || 1);
    const per = 25;
    const kata = String(q).toLowerCase();
    // shortcut: filter di memori; cukup untuk ≤2.000 kontrak (BREAKDOWN bagian 14), pindah ke SQL bila lebih.
    let daftar = semuaAktifData().filter((k) =>
      (!kata || [k.judul, k.nomor_kontrak, k.counterparty_nama].some((v) => String(v ?? '').toLowerCase().includes(kata))) &&
      (!status || k.status === status) &&
      (!divisi_id || k.divisi_id === Number(divisi_id)) &&
      (!tingkat || k.tingkat === tingkat) &&
      (!jenis || k.jenis_dokumen === jenis) &&
      (!rt || k.rentang === rt) &&
      (perlu !== 'notice' || k.notice_terlewat) &&
      (perlu !== 'auto_renew' || k.perlu_konfirmasi_auto_renew));
    const kunci = { sisa_hari: (k) => k.sisa_hari ?? Infinity, judul: (k) => k.judul.toLowerCase(), diubah: (k) => -Date.parse(k.diubah_pada) };
    const f = kunci[urut] || kunci.sisa_hari;
    daftar = daftar.sort((a, b) => (f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0));
    res.json({ total: daftar.length, halaman, per_halaman: per, data: daftar.slice((halaman - 1) * per, halaman * per) });
  }));

  api.post('/kontrak', jalankan((req, res) => {
    const d = bersihkan(req.body ?? {}, true);
    const baru = transaksi(db, () => {
      const cpId = cariCounterparty(d.counterparty_nama);
      const w = sekarangIso();
      try {
        const r = db.prepare(`INSERT INTO kontrak (nomor_kontrak, judul, jenis_dokumen, ruang_lingkup, counterparty_id, divisi_id, pic_nama,
          tanggal_ttd, tanggal_mulai, tanggal_berakhir, perpanjangan_otomatis, masa_pemberitahuan_hari, tingkat_risiko,
          tautan_dokumen_final, catatan, dibuat_pada, diubah_pada) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(d.nomor_kontrak ?? null, d.judul, d.jenis_dokumen, d.ruang_lingkup ?? null, cpId, d.divisi_id, d.pic_nama,
            d.tanggal_ttd ?? null, d.tanggal_mulai ?? null, d.tanggal_berakhir ?? null, d.perpanjangan_otomatis ?? 0,
            d.masa_pemberitahuan_hari ?? 0, d.tingkat_risiko ?? 'sedang', d.tautan_dokumen_final ?? null, d.catatan ?? null, w, w);
        const id = Number(r.lastInsertRowid);
        db.prepare('INSERT INTO riwayat_status (kontrak_id, status_lama, status_baru, pelaku_id, waktu) VALUES (?,?,?,?,?)')
          .run(id, null, 'draft', req.session.penggunaId, w);
        catat(req, 'kontrak_dibuat', 'kontrak', id);
        return id;
      } catch (e) { throw galatDb(e); }
    });
    res.status(201).json(perkaya(ambilKontrak(baru), hariIni(), ambang()));
  }));

  api.get('/kontrak/:id', jalankan((req, res) => {
    const k = perkaya(ambilKontrak(req.params.id), hariIni(), ambang());
    res.json({
      ...k,
      transisi_tersedia: TRANSISI[k.status] || [],
      riwayat_status: db.prepare(`SELECT r.*, p.nama AS pelaku_nama FROM riwayat_status r LEFT JOIN pengguna p ON p.id = r.pelaku_id
        WHERE kontrak_id = ? ORDER BY r.id DESC`).all(k.id),
      perpanjangan: db.prepare('SELECT * FROM perpanjangan WHERE kontrak_id = ? ORDER BY id DESC').all(k.id),
    });
  }));

  api.patch('/kontrak/:id', jalankan((req, res) => {
    const lama = ambilKontrak(req.params.id);
    const d = bersihkan(req.body ?? {}, false);
    transaksi(db, () => {
      if (d.counterparty_nama) d.counterparty_id = cariCounterparty(d.counterparty_nama);
      delete d.counterparty_nama;
      const kolom = Object.keys(d);
      if (!kolom.length) tolak('Tidak ada perubahan.');
      const gabung = { ...lama, ...d };
      // Status aktif ke atas tidak boleh kehilangan data wajib aktif.
      if (['aktif', 'negosiasi_perpanjangan'].includes(lama.status)) {
        const kurang = ['tautan_dokumen_final', 'nomor_kontrak', 'tanggal_ttd', 'tanggal_mulai', 'tanggal_berakhir'].filter((f) => !gabung[f]);
        if (kurang.length) tolak(`Kontrak berstatus aktif wajib memiliki: ${kurang.join(', ')}.`);
      }
      try {
        db.prepare(`UPDATE kontrak SET ${kolom.map((c) => `${c} = ?`).join(', ')}, diubah_pada = ? WHERE id = ?`)
          .run(...kolom.map((c) => d[c]), sekarangIso(), lama.id);
      } catch (e) { throw galatDb(e); }
      catat(req, 'kontrak_diubah', 'kontrak', lama.id, `kolom: ${kolom.join(',')}`);
    });
    res.json(perkaya(ambilKontrak(lama.id), hariIni(), ambang()));
  }));

  api.post('/kontrak/:id/transisi', jalankan((req, res) => {
    const k = ambilKontrak(req.params.id);
    const ke = String(req.body?.ke ?? '');
    const catatan = String(req.body?.catatan ?? '').trim().slice(0, 5000);
    const pesan = cekTransisi(k, ke, catatan);
    if (pesan) {
      catat(req, 'transisi_ditolak', 'kontrak', k.id, `${k.status}->${ke}`);
      tolak(pesan, 409, 'transisi_tidak_sah');
    }
    transaksi(db, () => {
      const w = sekarangIso();
      db.prepare('UPDATE kontrak SET status = ?, diubah_pada = ?, diarsipkan_pada = ? WHERE id = ?')
        .run(ke, w, ke === 'arsip' ? w : null, k.id);
      db.prepare('INSERT INTO riwayat_status (kontrak_id, status_lama, status_baru, pelaku_id, waktu, catatan) VALUES (?,?,?,?,?,?)')
        .run(k.id, k.status, ke, req.session.penggunaId, w, catatan || null);
      catat(req, 'transisi_status', 'kontrak', k.id, `${k.status}->${ke}`);
    });
    res.json({ ok: true });
  }));

  api.post('/kontrak/:id/perpanjangan', jalankan((req, res) => {
    const k = ambilKontrak(req.params.id);
    if (!['aktif', 'negosiasi_perpanjangan'].includes(k.status)) tolak('Hanya kontrak aktif atau dalam negosiasi yang bisa diperpanjang.', 409, 'transisi_tidak_sah');
    const baru = req.body?.tanggal_berakhir_baru;
    if (!tanggalSah(baru)) tolak('Tanggal berakhir baru harus berformat YYYY-MM-DD.');
    if (selisihHari(baru, k.tanggal_berakhir) <= 0) tolak('Tanggal berakhir baru harus setelah tanggal berakhir lama.');
    const catatan = String(req.body?.catatan ?? '').trim().slice(0, 5000) || null;
    transaksi(db, () => {
      const w = sekarangIso();
      const siklus = k.siklus_perpanjangan + 1;
      db.prepare('INSERT INTO perpanjangan (kontrak_id, siklus, tanggal_berakhir_lama, tanggal_berakhir_baru, dicatat_oleh, waktu, catatan) VALUES (?,?,?,?,?,?,?)')
        .run(k.id, siklus, k.tanggal_berakhir, baru, req.session.penggunaId, w, catatan);
      db.prepare("UPDATE kontrak SET tanggal_berakhir = ?, siklus_perpanjangan = ?, status = 'aktif', diubah_pada = ? WHERE id = ?")
        .run(baru, siklus, w, k.id);
      if (k.status !== 'aktif') {
        db.prepare('INSERT INTO riwayat_status (kontrak_id, status_lama, status_baru, pelaku_id, waktu, catatan) VALUES (?,?,?,?,?,?)')
          .run(k.id, k.status, 'aktif', req.session.penggunaId, w, 'Perpanjangan dicatat');
      }
      catat(req, 'perpanjangan', 'kontrak', k.id, `${k.tanggal_berakhir}->${baru}`);
    });
    res.json(perkaya(ambilKontrak(k.id), hariIni(), ambang()));
  }));

  // ---------- Dashboard ----------
  api.get('/dashboard', jalankan((_req, res) => {
    const semua = semuaAktifData();
    const dipantau = semua.filter((k) => ['aktif', 'negosiasi_perpanjangan'].includes(k.status));
    const awal = new Date(`${hariIni().slice(0, 7)}-01T00:00:00Z`);
    const bulan = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(awal.getUTCFullYear(), awal.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
    const perDivisi = {};
    for (const k of dipantau) perDivisi[k.divisi_nama] = (perDivisi[k.divisi_nama] || 0) + 1;
    const urgensi = (k) => Math.min(k.sisa_hari ?? Infinity, k.masa_pemberitahuan_hari > 0 ? selisihHari(k.tanggal_batas_notice, hariIni()) : Infinity);
    const { kuning } = ambang();
    res.json({
      kartu: {
        total: semua.length,
        aktif: semua.filter((k) => k.status === 'aktif').length,
        segera_berakhir: dipantau.filter((k) => k.mendekati_berakhir).length,
        berakhir: semua.filter((k) => k.status === 'berakhir').length,
        dalam_proses: semua.filter((k) => ['draft', 'review_legal', 'review_finance', 'persetujuan_direksi', 'menunggu_ttd'].includes(k.status)).length,
        notice_terlewat: dipantau.filter((k) => k.notice_terlewat).length,
        perlu_konfirmasi_auto_renew: dipantau.filter((k) => k.perlu_konfirmasi_auto_renew).length,
      },
      radar: rentang(ambang()).map(({ id, label, tingkat }) => ({ id, label, tingkat, jumlah: dipantau.filter((k) => k.rentang === id).length })),
      per_status: Object.entries(semua.reduce((a, k) => ({ ...a, [k.status]: (a[k.status] || 0) + 1 }), {})).map(([status, jumlah]) => ({ status, jumlah })),
      per_risiko: ['tinggi', 'sedang', 'rendah'].map((r) => ({ risiko: r, jumlah: dipantau.filter((k) => k.tingkat_risiko === r).length })),
      berakhir_per_bulan: bulan.map((b) => ({ bulan: b, jumlah: dipantau.filter((k) => k.tanggal_berakhir.startsWith(b)).length })),
      per_divisi: Object.entries(perDivisi).map(([divisi, jumlah]) => ({ divisi, jumlah })).sort((a, b) => b.jumlah - a.jumlah),
      prioritas: dipantau
        .filter((k) => k.sisa_hari <= kuning || k.notice_terlewat || k.perlu_konfirmasi_auto_renew)
        .sort((a, b) => urgensi(a) - urgensi(b))
        .slice(0, 15),
    });
  }));

  app.use('/api/v1', api);
  app.use('/api', (_req, res) => res.status(404).json({ kode: 'tidak_ditemukan', pesan: 'Endpoint tidak ditemukan.' }));

  // Klien React hasil build (npm run build).
  const dist = fileURLToPath(new URL('../client/dist', import.meta.url));
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(`${dist}/index.html`));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof Galat) return res.status(err.status).json({ kode: err.kode, pesan: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ kode: 'tidak_valid', pesan: 'Format permintaan tidak valid.' });
    console.error('galat:', err.message); // tanpa isi body agar data sensitif tidak bocor ke log
    res.status(500).json({ kode: 'galat', pesan: 'Terjadi kesalahan pada server.' });
  });

  return app;
}

function galatDb(e) {
  if (/UNIQUE/i.test(e.message) && /nomor_kontrak/i.test(e.message)) return new Galat(409, 'duplikat', 'Nomor kontrak sudah dipakai.');
  if (/CHECK/i.test(e.message)) return new Galat(400, 'tidak_valid', 'Tanggal berakhir harus setelah tanggal mulai.');
  if (/FOREIGN KEY/i.test(e.message)) return new Galat(400, 'tidak_valid', 'Divisi tidak ditemukan.');
  return e;
}

/** Job harian: ubah ke 'berakhir' (pelaku = sistem). Idempoten. */
export function jalankanJobHarian(db) {
  const hari = hariIni();
  const baris = db.prepare("SELECT * FROM kontrak WHERE status IN ('aktif','negosiasi_perpanjangan') AND diarsipkan_pada IS NULL").all();
  const w = sekarangIso();
  let n = 0;
  for (const k of baris.filter((x) => harusBerakhir(x, hari))) {
    transaksi(db, () => {
      db.prepare("UPDATE kontrak SET status = 'berakhir', diubah_pada = ? WHERE id = ?").run(w, k.id);
      db.prepare('INSERT INTO riwayat_status (kontrak_id, status_lama, status_baru, pelaku_id, waktu, catatan) VALUES (?,?,?,NULL,?,?)')
        .run(k.id, k.status, 'berakhir', w, 'Masa berlaku habis (otomatis)');
      db.prepare("INSERT INTO audit_log (waktu, aksi, objek_tabel, objek_id, ringkasan) VALUES (?, 'job_berakhir', 'kontrak', ?, ?)")
        .run(w, k.id, `${k.status}->berakhir`);
    });
    n++;
  }
  return n;
}
