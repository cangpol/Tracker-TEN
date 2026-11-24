// Kelola pengguna, persetujuan peran (four-eyes), audit log, dan ringkasan sistem. Hanya Admin Sistem (audit: juga Legal).
import { randomBytes } from 'node:crypto';
import { PERAN, ISTIMEWA, LABEL_PERAN, terbatasDivisi } from './akses.js';
import { hashSandi } from './sandi.js';
import { tolak } from './umum.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sandiAcak = () => randomBytes(9).toString('base64url');

const KOLOM = 'id, nama, email, peran, divisi_id, aktif, wajib_ganti, demo, terakhir_login';

// Aksi yang dianggap log keamanan (dilihat Admin Sistem). Log kontrak dilihat Legal.
const AKSI_KEAMANAN = ['login', 'login_demo', 'login_gagal', 'logout', 'akses_ditolak', 'transisi_dilarang', 'sandi_diganti', 'sandi_gagal_ganti',
  'pengguna_dibuat', 'pengguna_diubah', 'pengguna_dinonaktifkan', 'pengguna_diaktifkan', 'sandi_direset', 'peran_diminta', 'peran_disetujui', 'peran_ditolak',
  'divisi_dibuat', 'divisi_diubah'];
const AKSI_KONTRAK = ['kontrak_dibuat', 'kontrak_diubah', 'transisi_status', 'transisi_ditolak', 'perpanjangan', 'job_berakhir',
  'dokumen_ditambah', 'dokumen_dibuka', 'dokumen_diarsipkan', 'ekspor', 'pengaturan_diubah', 'aturan_reminder_dibuat', 'aturan_reminder_diubah'];

export function pasangPengguna(api, { db, catat, izin }) {
  const adminAktif = async (q = db) => (await q.satu("SELECT count(*)::int AS n FROM pengguna WHERE peran = 'admin_sistem' AND aktif")).n;
  const cari = async (id, q = db) => {
    const p = await q.satu(`SELECT ${KOLOM} FROM pengguna WHERE id = $1`, [Number(id) || 0]);
    if (!p) tolak('Pengguna tidak ditemukan.', 404, 'tidak_ditemukan');
    return p;
  };
  const tidakDemo = (p) => { if (p.demo) tolak('Akun demo tidak dapat diubah.', 403, 'dilarang'); };
  const bersihDivisi = async (v, peran, q = db) => {
    if (v === undefined || v === null || v === '') {
      if (terbatasDivisi(peran)) tolak('PIC harus memiliki divisi.');
      return null;
    }
    const n = Number(v);
    if (!Number.isInteger(n) || !(await q.satu('SELECT 1 FROM divisi WHERE id = $1 AND aktif', [n]))) tolak('Divisi tidak ditemukan.');
    return n;
  };
  const antrianPeran = async (t, req, pengguna, peranBaru) => {
    if (await t.satu("SELECT 1 FROM permintaan_peran WHERE pengguna_id = $1 AND status = 'menunggu'", [pengguna.id])) {
      tolak('Sudah ada permintaan peran yang menunggu persetujuan untuk pengguna ini.', 409, 'duplikat');
    }
    await t.jalankan('INSERT INTO permintaan_peran (pengguna_id, peran_lama, peran_baru, diminta_oleh) VALUES ($1,$2,$3,$4)', [pengguna.id, pengguna.peran, peranBaru, req.pengguna.id]);
    await catat(req, 'peran_diminta', 'pengguna', pengguna.id, `${pengguna.peran}->${peranBaru}`, t);
  };

  api.get('/pengguna', izin('kelola_pengguna'), async (_req, res, next) => {
    try {
      res.json({
        pengguna: (await db.q(`SELECT p.id, p.nama, p.email, p.peran, p.divisi_id, d.nama AS divisi_nama, p.aktif, p.wajib_ganti, p.demo, p.terakhir_login
          FROM pengguna p LEFT JOIN divisi d ON d.id = p.divisi_id ORDER BY p.aktif DESC, p.nama`)).map((p) => ({ ...p, peran_label: LABEL_PERAN[p.peran] })),
        permintaan: await db.q(`SELECT r.id, r.pengguna_id, u.nama AS pengguna_nama, r.peran_lama, r.peran_baru, r.diminta_oleh, m.nama AS diminta_nama, r.waktu
          FROM permintaan_peran r JOIN pengguna u ON u.id = r.pengguna_id JOIN pengguna m ON m.id = r.diminta_oleh
          WHERE r.status = 'menunggu' ORDER BY r.id`),
        peran: PERAN.map((p) => ({ id: p, label: LABEL_PERAN[p], istimewa: ISTIMEWA.includes(p) })),
      });
    } catch (e) { next(e); }
  });

  api.post('/pengguna', izin('kelola_pengguna'), async (req, res, next) => {
    try {
      const nama = String(req.body?.nama ?? '').trim();
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const peran = String(req.body?.peran ?? '');
      if (!nama || nama.length > 150) tolak('Nama wajib diisi (maks 150 karakter).');
      if (!EMAIL_RE.test(email) || email.length > 200) tolak('Email tidak valid.');
      if (!PERAN.includes(peran)) tolak('Peran tidak valid.');
      const divisi = await bersihDivisi(req.body?.divisi_id, peran);
      if (await db.satu('SELECT 1 FROM pengguna WHERE email = $1', [email])) tolak('Email sudah terdaftar.', 409, 'duplikat');
      const sandi = sandiAcak();
      // Peran istimewa tidak langsung berlaku: akun dibuat sebagai Viewer sampai admin kedua menyetujui.
      const awal = ISTIMEWA.includes(peran) ? 'viewer' : peran;
      const id = await db.tx(async (t) => {
        const baru = (await t.satu('INSERT INTO pengguna (nama, email, sandi_hash, peran, divisi_id, wajib_ganti) VALUES ($1,$2,$3,$4,$5,true) RETURNING id',
          [nama, email, hashSandi(sandi), awal, divisi])).id;
        await catat(req, 'pengguna_dibuat', 'pengguna', baru, `peran awal ${awal}`, t);
        if (awal !== peran) await antrianPeran(t, req, { id: baru, peran: awal }, peran);
        return baru;
      });
      // Sandi sementara hanya ditampilkan sekali di respons ini, tidak disimpan dan tidak dicatat.
      res.status(201).json({ pengguna: await cari(id), sandi_sementara: sandi, menunggu_persetujuan: awal !== peran });
    } catch (e) { next(e); }
  });

  api.patch('/pengguna/:id', izin('kelola_pengguna'), async (req, res, next) => {
    try {
      const p = await cari(req.params.id);
      tidakDemo(p);
      const b = req.body ?? {};
      const diri = p.id === req.pengguna.id;
      let menunggu = false;
      await db.tx(async (t) => {
        if (b.peran !== undefined && b.peran !== p.peran) {
          if (!PERAN.includes(b.peran)) tolak('Peran tidak valid.');
          if (diri) tolak('Anda tidak dapat mengubah peran akun Anda sendiri.', 403, 'dilarang');
          if (p.peran === 'admin_sistem' && p.aktif && (await adminAktif(t)) <= 1) tolak('Tidak bisa menurunkan Admin Sistem terakhir.', 409, 'konflik');
          if (ISTIMEWA.includes(b.peran)) { await antrianPeran(t, req, p, b.peran); menunggu = true; }
          else {
            await t.jalankan('UPDATE pengguna SET peran = $1 WHERE id = $2', [b.peran, p.id]);
            await catat(req, 'pengguna_diubah', 'pengguna', p.id, `peran ${p.peran}->${b.peran}`, t);
          }
        }
        const peranSekarang = menunggu ? p.peran : (b.peran ?? p.peran);
        if (b.divisi_id !== undefined || (b.peran !== undefined && terbatasDivisi(peranSekarang))) {
          const divisi = await bersihDivisi(b.divisi_id !== undefined ? b.divisi_id : p.divisi_id, peranSekarang, t);
          await t.jalankan('UPDATE pengguna SET divisi_id = $1 WHERE id = $2', [divisi, p.id]);
          await catat(req, 'pengguna_diubah', 'pengguna', p.id, 'divisi', t);
        }
        if (b.nama !== undefined) {
          const nama = String(b.nama).trim();
          if (!nama || nama.length > 150) tolak('Nama wajib diisi (maks 150 karakter).');
          await t.jalankan('UPDATE pengguna SET nama = $1 WHERE id = $2', [nama, p.id]);
          await catat(req, 'pengguna_diubah', 'pengguna', p.id, 'nama', t);
        }
        if (b.aktif !== undefined && !!b.aktif !== p.aktif) {
          if (diri) tolak('Anda tidak dapat menonaktifkan akun Anda sendiri.', 403, 'dilarang');
          if (!b.aktif && p.peran === 'admin_sistem' && (await adminAktif(t)) <= 1) tolak('Tidak bisa menonaktifkan Admin Sistem terakhir.', 409, 'konflik');
          await t.jalankan('UPDATE pengguna SET aktif = $1 WHERE id = $2', [!!b.aktif, p.id]);
          await catat(req, b.aktif ? 'pengguna_diaktifkan' : 'pengguna_dinonaktifkan', 'pengguna', p.id, null, t);
        }
      });
      res.json({ pengguna: await cari(p.id), menunggu_persetujuan: menunggu });
    } catch (e) { next(e); }
  });

  api.post('/pengguna/:id/reset-sandi', izin('kelola_pengguna'), async (req, res, next) => {
    try {
      const p = await cari(req.params.id);
      tidakDemo(p);
      if (p.id === req.pengguna.id) tolak('Ganti kata sandi sendiri lewat menu Akun.', 403, 'dilarang');
      const sandi = sandiAcak();
      await db.jalankan('UPDATE pengguna SET sandi_hash = $1, wajib_ganti = true WHERE id = $2', [hashSandi(sandi), p.id]);
      await catat(req, 'sandi_direset', 'pengguna', p.id);
      res.json({ sandi_sementara: sandi });
    } catch (e) { next(e); }
  });

  // Persetujuan orang kedua untuk peran istimewa.
  api.post('/permintaan-peran/:id/:keputusan', izin('kelola_pengguna'), async (req, res, next) => {
    try {
      const { keputusan } = req.params;
      if (!['setujui', 'tolak'].includes(keputusan)) tolak('Keputusan tidak valid.');
      const r = await db.satu("SELECT * FROM permintaan_peran WHERE id = $1 AND status = 'menunggu'", [Number(req.params.id) || 0]);
      if (!r) tolak('Permintaan tidak ditemukan atau sudah diputuskan.', 404, 'tidak_ditemukan');
      if (r.diminta_oleh === req.pengguna.id) tolak('Permintaan harus diputuskan oleh Admin Sistem lain, bukan pemohon.', 403, 'dilarang');
      await db.tx(async (t) => {
        const u = await t.jalankan("UPDATE permintaan_peran SET status = $1, diputuskan_oleh = $2, waktu_putus = now() WHERE id = $3 AND status = 'menunggu'",
          [keputusan === 'setujui' ? 'disetujui' : 'ditolak', req.pengguna.id, r.id]);
        if (!u.rowCount) tolak('Permintaan sudah diputuskan.', 409, 'konflik');
        if (keputusan === 'setujui') await t.jalankan('UPDATE pengguna SET peran = $1 WHERE id = $2', [r.peran_baru, r.pengguna_id]);
        await catat(req, keputusan === 'setujui' ? 'peran_disetujui' : 'peran_ditolak', 'pengguna', r.pengguna_id, `${r.peran_lama}->${r.peran_baru}`, t);
      });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // ---------- Audit log ----------
  api.get('/audit-log', izin('lihat_audit'), async (req, res, next) => {
    try {
      const aksi = req.pengguna.peran === 'admin_sistem' ? AKSI_KEAMANAN : AKSI_KONTRAK;
      const halaman = Math.max(1, parseInt(req.query.halaman, 10) || 1);
      const per = 50;
      // Filter di luar jatah peran diabaikan, bukan dibocorkan.
      const filter = aksi.includes(req.query.aksi) ? [req.query.aksi] : aksi;
      const total = (await db.satu('SELECT count(*)::int AS n FROM audit_log WHERE aksi = ANY($1)', [filter])).n;
      const data = await db.q(`SELECT a.id, a.waktu, a.aksi, a.objek_tabel, a.objek_id, a.ringkasan, a.ip, p.nama AS pelaku_nama
        FROM audit_log a LEFT JOIN pengguna p ON p.id = a.pelaku_id WHERE a.aksi = ANY($1) ORDER BY a.id DESC LIMIT $2 OFFSET $3`,
      [filter, per, (halaman - 1) * per]);
      res.json({ total, halaman, per_halaman: per, aksi, data });
    } catch (e) { next(e); }
  });

  // ---------- Dashboard Admin Sistem: kesehatan sistem. Sengaja tanpa isi atau jumlah kontrak. ----------
  api.get('/admin/ringkasan', izin('dashboard_sistem'), async (_req, res, next) => {
    try {
      const n = async (sql, ...a) => (await db.satu(sql, a)).n;
      const sejak = new Date(Date.now() - 24 * 3600 * 1000);
      const jobTerakhir = (await db.satu("SELECT nilai FROM pengaturan WHERE kunci = 'job_terakhir'"))?.nilai ?? null;
      const notif = await db.q("SELECT kanal, status, count(*)::int AS n FROM pengiriman_notifikasi WHERE dikirim_pada >= $1 GROUP BY 1, 2", [sejak]);
      res.json({
        pengguna: {
          total: await n('SELECT count(*)::int AS n FROM pengguna'),
          aktif: await n('SELECT count(*)::int AS n FROM pengguna WHERE aktif'),
          nonaktif: await n('SELECT count(*)::int AS n FROM pengguna WHERE NOT aktif'),
          belum_ganti_sandi: await n('SELECT count(*)::int AS n FROM pengguna WHERE aktif AND wajib_ganti'),
          belum_pernah_login: await n('SELECT count(*)::int AS n FROM pengguna WHERE aktif AND terakhir_login IS NULL AND NOT demo'),
          per_peran: await Promise.all(PERAN.map(async (p) => ({ peran: p, label: LABEL_PERAN[p], jumlah: await n('SELECT count(*)::int AS n FROM pengguna WHERE aktif AND peran = $1', p) }))),
        },
        // Hanya jumlah akun per unit (tanpa data kontrak): unit tanpa PIC aktif tidak punya penerima notifikasi.
        per_unit: await db.q(`SELECT d.id, d.kode, d.nama, count(p.id)::int AS pic_aktif FROM divisi d
          LEFT JOIN pengguna p ON p.divisi_id = d.id AND p.peran = 'pic' AND p.aktif WHERE d.aktif GROUP BY d.id ORDER BY d.nama`),
        permintaan_peran_menunggu: await n("SELECT count(*)::int AS n FROM permintaan_peran WHERE status = 'menunggu'"),
        keamanan_24_jam: {
          login_berhasil: await n("SELECT count(*)::int AS n FROM audit_log WHERE aksi IN ('login','login_demo') AND waktu >= $1", sejak),
          login_gagal: await n("SELECT count(*)::int AS n FROM audit_log WHERE aksi = 'login_gagal' AND waktu >= $1", sejak),
          akses_ditolak: await n("SELECT count(*)::int AS n FROM audit_log WHERE aksi IN ('akses_ditolak','transisi_dilarang') AND waktu >= $1", sejak),
        },
        notifikasi_24_jam: {
          email_terkirim: notif.find((x) => x.kanal === 'email' && x.status === 'terkirim')?.n ?? 0,
          email_gagal: notif.find((x) => x.kanal === 'email' && x.status === 'gagal')?.n ?? 0,
          dalam_aplikasi: notif.filter((x) => x.kanal === 'app' && x.status === 'terkirim').reduce((a, x) => a + x.n, 0),
          email_aktif: !!process.env.SMTP_URL,
        },
        sistem: {
          job_terakhir: jobTerakhir, waktu_server: new Date().toISOString(), zona_bisnis: 'Asia/Jakarta',
          uptime_detik: Math.round(process.uptime()), node: process.version, database: 'PostgreSQL',
          jumlah_audit_log: await n('SELECT count(*)::int AS n FROM audit_log'),
          mode_demo: process.env.DEMO_MODE === '1',
        },
        peristiwa: await db.q(`SELECT a.id, a.waktu, a.aksi, a.ringkasan, p.nama AS pelaku_nama FROM audit_log a LEFT JOIN pengguna p ON p.id = a.pelaku_id
          WHERE a.aksi = ANY($1) ORDER BY a.id DESC LIMIT 8`, [AKSI_KEAMANAN]),
      });
    } catch (e) { next(e); }
  });
}
