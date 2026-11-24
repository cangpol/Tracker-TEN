import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { cocokSandi, hashSandi, HASH_PALSU } from './sandi.js';
import { boleh, izinPeran, LABEL_PERAN, RINGKAS_PERAN, PERAN } from './akses.js';
import { PgStore } from './sesi.js';
import { Galat, tolak } from './umum.js';
import { domainDiizinkan } from './data.js';
import { pasangKontrak, JENIS, RISIKO, JENIS_KONTRAK, KATEGORI } from './kontrak.js';
import { pasangPengguna } from './pengguna.js';
import { pasangNotifikasi } from './notifikasi.js';
import { pasangMaster } from './master.js';
import { jalankanJobBerakhir, jalankanReminder } from './jobs.js';

const BATAS_LOGIN_GAGAL = 10; // per IP per 15 menit, dihitung dari audit_log agar berlaku lintas instance

const regenerasi = (req) => new Promise((ok, gagal) => req.session.regenerate((e) => (e ? gagal(e) : ok())));

export function buatApp(db, { kirimEmail = null } = {}) {
  const app = express();
  const produksi = process.env.NODE_ENV === 'production';
  if (produksi && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET wajib diisi di produksi.');
  const demoAktif = () => process.env.DEMO_MODE === '1';

  app.disable('x-powered-by');
  if (process.env.VERCEL || process.env.TRUST_PROXY) app.set('trust proxy', 1); // di belakang proxy: IP dan cookie secure benar
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  // Cron (Vercel Cron atau penjadwal lain): dijaga rahasia, sebelum sesi agar tanpa overhead.
  app.get('/api/cron/:job', async (req, res, next) => {
    try {
      const rahasia = process.env.CRON_SECRET;
      if (!rahasia) return res.status(503).json({ kode: 'cron_nonaktif', pesan: 'CRON_SECRET belum diatur.' });
      const a = Buffer.from(req.get('authorization') || ''); const b = Buffer.from(`Bearer ${rahasia}`);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ kode: 'belum_login', pesan: 'Tidak diizinkan.' });
      const { job } = req.params;
      if (!['berakhir', 'reminder', 'semua'].includes(job)) return res.status(404).json({ kode: 'tidak_ditemukan', pesan: 'Job tidak dikenal.' });
      const hasil = {};
      if (job !== 'reminder') hasil.berakhir = await jalankanJobBerakhir(db);
      if (job !== 'berakhir') hasil.reminder = await jalankanReminder(db, { kirimEmail });
      res.json(hasil);
    } catch (e) { next(e); }
  });

  app.use(session({
    name: 'ten.sid',
    secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    store: new PgStore(db),
    cookie: { httpOnly: true, sameSite: 'strict', secure: produksi, maxAge: 8 * 3600 * 1000 },
  }));

  // Pelaku diambil dari sesi; aksi anonim (login gagal) tercatat tanpa pelaku.
  const catat = (req, aksi, tabel = null, id = null, ringkasan = null, q = db) =>
    q.jalankan('INSERT INTO audit_log (pelaku_id, ip, aksi, objek_tabel, objek_id, ringkasan) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.pengguna?.id ?? req.session?.penggunaId ?? null, req.ip, aksi, tabel, id, ringkasan]);

  const profil = (p) => ({
    id: p.id, nama: p.nama, email: demoAktif() && p.demo ? undefined : p.email, peran: p.peran, peran_label: LABEL_PERAN[p.peran],
    divisi_id: p.divisi_id, wajib_ganti: !!p.wajib_ganti, demo: !!p.demo, izin: izinPeran(p.peran),
  });

  const api = express.Router();

  // ---------- Publik: demo dan login ----------
  api.get('/demo/akun', async (_req, res, next) => {
    try {
      if (!demoAktif()) return res.json({ aktif: false, akun: [] });
      const baris = await db.q('SELECT id, nama, peran FROM pengguna WHERE demo AND aktif');
      const urut = baris.sort((a, b) => PERAN.indexOf(a.peran) - PERAN.indexOf(b.peran) || a.id - b.id);
      res.json({ aktif: true, akun: urut.map((p) => ({ id: p.id, nama: p.nama, peran: p.peran, peran_label: LABEL_PERAN[p.peran], ringkas: RINGKAS_PERAN[p.peran] })) });
    } catch (e) { next(e); }
  });

  // Login satu klik untuk akun demo. Hanya bila DEMO_MODE=1 dan akunnya bertanda demo; akun demo tidak punya kata sandi yang diketahui.
  api.post('/auth/demo', async (req, res, next) => {
    try {
      if (!demoAktif()) return res.status(404).json({ kode: 'tidak_ditemukan', pesan: 'Endpoint tidak ditemukan.' });
      const p = await db.satu('SELECT * FROM pengguna WHERE id = $1 AND demo AND aktif', [Number(req.body?.id) || 0]);
      if (!p) return res.status(404).json({ kode: 'tidak_ditemukan', pesan: 'Akun demo tidak ditemukan.' });
      await regenerasi(req);
      req.session.penggunaId = p.id;
      await db.jalankan('UPDATE pengguna SET terakhir_login = now() WHERE id = $1', [p.id]);
      await catat(req, 'login_demo', 'pengguna', p.id);
      res.json(profil(p));
    } catch (e) { next(e); }
  });

  api.post('/auth/login', async (req, res, next) => {
    try {
      const gagal = (await db.satu("SELECT count(*)::int AS n FROM audit_log WHERE aksi = 'login_gagal' AND ip = $1 AND waktu > now() - interval '15 minutes'", [req.ip])).n;
      if (gagal >= BATAS_LOGIN_GAGAL) return res.status(429).json({ kode: 'terlalu_banyak', pesan: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const sandi = String(req.body?.sandi ?? '');
      const p = await db.satu('SELECT * FROM pengguna WHERE email = $1 AND aktif', [email]);
      // Hash palsu agar waktu respons sama bila email tidak ada (cegah enumerasi akun).
      const ok = cocokSandi(sandi, p ? p.sandi_hash : HASH_PALSU) && p;
      if (!ok) {
        await catat(req, 'login_gagal', 'pengguna');
        return res.status(401).json({ kode: 'login_gagal', pesan: 'Email atau kata sandi salah.' });
      }
      await regenerasi(req);
      req.session.penggunaId = p.id;
      await db.jalankan('UPDATE pengguna SET terakhir_login = now() WHERE id = $1', [p.id]);
      await catat(req, 'login', 'pengguna', p.id);
      res.json(profil(p));
    } catch (e) { next(e); }
  });

  api.post('/auth/logout', async (req, res, next) => {
    try {
      if (req.session.penggunaId) await catat(req, 'logout');
      req.session.destroy(() => res.clearCookie('ten.sid').json({ ok: true }));
    } catch (e) { next(e); }
  });

  // ---------- Wajib login ----------
  // Pengguna dimuat dari database tiap permintaan: akun yang dinonaktifkan atau diubah perannya langsung berlaku.
  api.use(async (req, res, next) => {
    try {
      const p = req.session.penggunaId && await db.satu('SELECT * FROM pengguna WHERE id = $1', [req.session.penggunaId]);
      if (!p || !p.aktif) {
        const galat = { kode: 'belum_login', pesan: 'Silakan login terlebih dahulu.' };
        return req.session.penggunaId ? req.session.destroy(() => res.status(401).json(galat)) : res.status(401).json(galat);
      }
      req.pengguna = p;
      if (p.wajib_ganti && !['/auth/saya', '/auth/ganti-sandi', '/auth/logout'].includes(req.path)) {
        return res.status(403).json({ kode: 'wajib_ganti_sandi', pesan: 'Ganti kata sandi Anda terlebih dahulu.' });
      }
      next();
    } catch (e) { next(e); }
  });

  const izin = (aksi) => async (req, res, next) => {
    if (boleh(req.pengguna.peran, aksi)) return next();
    try { await catat(req, 'akses_ditolak', null, null, aksi); } catch (e) { return next(e); }
    res.status(403).json({ kode: 'dilarang', pesan: 'Anda tidak memiliki hak akses untuk tindakan ini.' });
  };

  api.get('/auth/saya', (req, res) => res.json(profil(req.pengguna)));

  api.post('/auth/ganti-sandi', async (req, res, next) => {
    try {
      if (req.pengguna.demo) tolak('Akun demo tidak dapat mengganti kata sandi.', 403, 'dilarang');
      const lama = String(req.body?.lama ?? ''); const baru = String(req.body?.baru ?? '');
      if (!cocokSandi(lama, req.pengguna.sandi_hash)) { await catat(req, 'sandi_gagal_ganti', 'pengguna', req.pengguna.id); tolak('Kata sandi lama salah.'); }
      if (baru.length < 12 || baru.length > 200) tolak('Kata sandi baru minimal 12 karakter.');
      if (baru === lama) tolak('Kata sandi baru harus berbeda dari yang lama.');
      await db.jalankan('UPDATE pengguna SET sandi_hash = $1, wajib_ganti = false WHERE id = $2', [hashSandi(baru), req.pengguna.id]);
      await catat(req, 'sandi_diganti', 'pengguna', req.pengguna.id);
      res.json(profil({ ...req.pengguna, wajib_ganti: false }));
    } catch (e) { next(e); }
  });

  api.get('/master', async (req, res, next) => {
    try {
      const lihat = boleh(req.pengguna.peran, 'lihat_kontrak');
      res.json({
        divisi: await db.q('SELECT id, kode, nama FROM divisi WHERE aktif ORDER BY nama'),
        counterparty: lihat ? (await db.q('SELECT nama FROM counterparty ORDER BY nama')).map((r) => r.nama) : [],
        jenis_dokumen: JENIS, tingkat_risiko: RISIKO, jenis_kontrak: JENIS_KONTRAK, kategori_dokumen: KATEGORI,
        domain_tautan: lihat ? await domainDiizinkan(db) : [],
      });
    } catch (e) { next(e); }
  });

  const ctx = { db, catat, izin, tolak };
  pasangPengguna(api, ctx);
  pasangNotifikasi(api, { db, tolak, jalankan: (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next) });
  pasangMaster(api, ctx);
  pasangKontrak(api, ctx);

  app.use('/api/v1', api);
  app.use('/api', (_req, res) => res.status(404).json({ kode: 'tidak_ditemukan', pesan: 'Endpoint tidak ditemukan.' }));

  // Klien React hasil build, untuk menjalankan tanpa Vercel (npm start). Di Vercel berkas statis dilayani CDN.
  const dist = fileURLToPath(new URL('../client/dist', import.meta.url));
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(`${dist}/index.html`));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof Galat) return res.status(err.status).json({ kode: err.kode, pesan: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ kode: 'tidak_valid', pesan: 'Format permintaan tidak valid.' });
    console.error('galat:', err.code ?? '', err.message); // tanpa isi body/parameter agar data sensitif tidak bocor ke log
    res.status(500).json({ kode: 'galat', pesan: 'Terjadi kesalahan pada server.' });
  });

  return app;
}
