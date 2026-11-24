// Master data: divisi (Admin Sistem), aturan reminder dan pengaturan bisnis (Legal). BREAKDOWN bagian 2 dan 5.
import { tolak } from './umum.js';

const KUNCI = ['batas_kuning_hari', 'batas_oranye_hari', 'ambang_direksi', 'domain_tautan_diizinkan'];
const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

const baca = async (db) => Object.fromEntries((await db.q('SELECT kunci, nilai FROM pengaturan WHERE kunci = ANY($1)', [KUNCI])).map((r) => [r.kunci, r.nilai]));

export function pasangMaster(api, { db, catat, izin }) {
  // ---------- Divisi ----------
  api.get('/divisi', izin('kelola_divisi'), async (_req, res, next) => {
    try {
      res.json(await db.q(`SELECT d.id, d.kode, d.nama, d.aktif,
        (SELECT count(*)::int FROM pengguna p WHERE p.divisi_id = d.id AND p.aktif) AS pengguna_aktif,
        (SELECT count(*)::int FROM kontrak k WHERE k.divisi_id = d.id AND k.diarsipkan_pada IS NULL) AS kontrak
        FROM divisi d ORDER BY d.aktif DESC, d.nama`));
    } catch (e) { next(e); }
  });

  api.post('/divisi', izin('kelola_divisi'), async (req, res, next) => {
    try {
      const kode = String(req.body?.kode ?? '').trim().toUpperCase();
      const nama = String(req.body?.nama ?? '').trim();
      if (!/^[A-Z0-9_]{2,10}$/.test(kode)) tolak('Kode divisi 2–10 karakter: huruf, angka, atau garis bawah.');
      if (!nama || nama.length > 100) tolak('Nama divisi wajib diisi (maks 100 karakter).');
      const r = await db.satu('INSERT INTO divisi (kode, nama) VALUES ($1,$2) ON CONFLICT (kode) DO NOTHING RETURNING id, kode, nama, aktif', [kode, nama]);
      if (!r) tolak('Kode divisi sudah dipakai.', 409, 'duplikat');
      await catat(req, 'divisi_dibuat', 'divisi', r.id, kode);
      res.status(201).json(r);
    } catch (e) { next(e); }
  });

  api.patch('/divisi/:id', izin('kelola_divisi'), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const d = await db.satu('SELECT * FROM divisi WHERE id = $1', [id]);
      if (!d) tolak('Divisi tidak ditemukan.', 404, 'tidak_ditemukan');
      const nama = req.body?.nama === undefined ? d.nama : String(req.body.nama).trim();
      if (!nama || nama.length > 100) tolak('Nama divisi wajib diisi (maks 100 karakter).');
      const aktif = req.body?.aktif === undefined ? d.aktif : !!req.body.aktif;
      await db.jalankan('UPDATE divisi SET nama = $1, aktif = $2 WHERE id = $3', [nama, aktif, id]);
      await catat(req, 'divisi_diubah', 'divisi', id, aktif === d.aktif ? 'nama' : aktif ? 'diaktifkan' : 'dinonaktifkan');
      res.json({ id, kode: d.kode, nama, aktif });
    } catch (e) { next(e); }
  });

  // ---------- Aturan reminder ----------
  api.get('/aturan-reminder', izin('kelola_master_bisnis'), async (_req, res, next) => {
    try { res.json(await db.q('SELECT * FROM aturan_reminder ORDER BY acuan, hari_sebelum DESC, peran_penerima')); } catch (e) { next(e); }
  });

  const cekAturan = (b) => {
    const o = {};
    if (b.acuan !== undefined) { if (!['berakhir', 'notice'].includes(b.acuan)) tolak('Acuan harus berakhir atau notice.'); o.acuan = b.acuan; }
    if (b.peran_penerima !== undefined) { if (!['pic', 'legal', 'direksi'].includes(b.peran_penerima)) tolak('Penerima harus pic, legal, atau direksi.'); o.peran_penerima = b.peran_penerima; }
    if (b.hari_sebelum !== undefined) {
      const n = Number(b.hari_sebelum);
      if (!Number.isInteger(n) || n < 1 || n > 3650) tolak('Hari sebelum harus bilangan bulat 1–3650.');
      o.hari_sebelum = n;
    }
    if (b.aktif !== undefined) o.aktif = !!b.aktif;
    return o;
  };

  api.post('/aturan-reminder', izin('kelola_master_bisnis'), async (req, res, next) => {
    try {
      const o = cekAturan(req.body ?? {});
      for (const f of ['acuan', 'peran_penerima', 'hari_sebelum']) if (o[f] === undefined) tolak(`Kolom ${f} wajib diisi.`);
      const r = await db.satu('INSERT INTO aturan_reminder (acuan, hari_sebelum, peran_penerima, aktif) VALUES ($1,$2,$3,$4) RETURNING *', [o.acuan, o.hari_sebelum, o.peran_penerima, o.aktif ?? true]);
      await catat(req, 'aturan_reminder_dibuat', 'aturan_reminder', r.id, `${o.acuan} H-${o.hari_sebelum} ${o.peran_penerima}`);
      res.status(201).json(r);
    } catch (e) { next(e); }
  });

  // Tidak ada hapus: nonaktifkan agar riwayat pengiriman tetap bermakna.
  api.patch('/aturan-reminder/:id', izin('kelola_master_bisnis'), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const o = cekAturan(req.body ?? {});
      const kolom = Object.keys(o);
      if (!kolom.length) tolak('Tidak ada perubahan.');
      const r = await db.satu(`UPDATE aturan_reminder SET ${kolom.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${kolom.length + 1} RETURNING *`, [...kolom.map((c) => o[c]), id]);
      if (!r) tolak('Aturan tidak ditemukan.', 404, 'tidak_ditemukan');
      await catat(req, 'aturan_reminder_diubah', 'aturan_reminder', id, `kolom: ${kolom.join(',')}`);
      res.json(r);
    } catch (e) { next(e); }
  });

  // ---------- Pengaturan bisnis ----------
  api.get('/pengaturan', izin('kelola_master_bisnis'), async (_req, res, next) => {
    try { res.json(await baca(db)); } catch (e) { next(e); }
  });

  api.patch('/pengaturan', izin('kelola_master_bisnis'), async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const saatIni = await baca(db);
      const baru = { ...saatIni };
      for (const f of ['batas_kuning_hari', 'batas_oranye_hari']) {
        if (b[f] === undefined) continue;
        const n = Number(b[f]);
        if (!Number.isInteger(n) || n < 1 || n > 3650) tolak('Batas hari harus bilangan bulat 1–3650.');
        baru[f] = String(n);
      }
      if (Number(baru.batas_kuning_hari) <= Number(baru.batas_oranye_hari)) tolak('Batas kuning harus lebih besar dari batas oranye.');
      if (b.ambang_direksi !== undefined) {
        const v = String(b.ambang_direksi).trim();
        if (!/^\d{1,16}(\.\d{1,2})?$/.test(v)) tolak('Ambang Direksi harus angka (0 = nonaktif), maks 2 desimal.');
        baru.ambang_direksi = v;
      }
      if (b.domain_tautan_diizinkan !== undefined) {
        const daftar = String(b.domain_tautan_diizinkan).split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
        if (!daftar.length) tolak('Minimal satu domain tautan harus diizinkan.');
        if (daftar.some((d) => !HOST_RE.test(d))) tolak('Domain tidak valid. Pisahkan dengan koma, mis. drive.google.com,sharepoint.com.');
        baru.domain_tautan_diizinkan = [...new Set(daftar)].join(',');
      }
      const diubah = KUNCI.filter((k) => baru[k] !== saatIni[k]);
      await db.tx(async (t) => {
        for (const k of diubah) await t.jalankan('INSERT INTO pengaturan (kunci, nilai) VALUES ($1,$2) ON CONFLICT (kunci) DO UPDATE SET nilai = EXCLUDED.nilai', [k, baru[k]]);
        if (diubah.length) await catat(req, 'pengaturan_diubah', 'pengaturan', null, `kunci: ${diubah.join(',')}`, t);
      });
      res.json(baru);
    } catch (e) { next(e); }
  });
}
