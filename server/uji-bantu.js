// Pembantu tes (bukan tes). Tiap berkas tes memakai skema PostgreSQL sementara sendiri, dihapus setelah selesai.
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { bukaDb, migrasi } from './db.js';
import { buatApp } from './app.js';
import { hashSandi } from './sandi.js';
import { hariIni, tambahHari } from './logika.js';

export const SANDI = 'sandi-uji-12345';
export const H = hariIni();
export { tambahHari };

export async function mulai({ kirimEmail = null } = {}) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL belum diatur: arahkan ke database KOSONG khusus tes (lihat .env.example).');
  const skema = `uji_${randomBytes(4).toString('hex')}`;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${skema}`);
  const db = bukaDb({ url, skema });
  await migrasi(db);
  await db.jalankan("UPDATE pengaturan SET nilai = 'drive.example,docs.example' WHERE kunci = 'domain_tautan_diizinkan'");
  const server = buatApp(db, { kirimEmail }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const origin = `http://127.0.0.1:${server.address().port}`;

  /** Satu klien = satu sesi (cookie sendiri). `.mentah` mengembalikan Response asli tanpa mengikuti redirect. */
  const klien = () => {
    let cookie = '';
    const kirim = (metode, path, body, opsi = {}) => fetch(origin + path, {
      method: metode, redirect: 'manual', ...opsi,
      headers: { 'content-type': 'application/json', cookie, ...opsi.headers }, body: body ? JSON.stringify(body) : undefined,
    }).then((r) => { const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return r; });
    const api = async (metode, path, body) => {
      const r = await kirim(metode, `/api/v1${path}`, body);
      return { status: r.status, data: await r.json().catch(() => null) };
    };
    api.mentah = (metode, path) => kirim(metode, `/api/v1${path}`);
    return api;
  };
  const divisiId = async (kode) => (await db.satu('SELECT id FROM divisi WHERE kode = $1', [kode])).id;
  const buatPengguna = async (email, peran, kodeDivisi = null, wajibGanti = false) =>
    (await db.satu('INSERT INTO pengguna (nama, email, sandi_hash, peran, divisi_id, wajib_ganti) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [`Uji ${peran}`, email, hashSandi(SANDI), peran, kodeDivisi ? await divisiId(kodeDivisi) : null, wajibGanti])).id;
  const masuk = async (email, sandi = SANDI) => {
    const k = klien();
    const r = await k('POST', '/auth/login', { email, sandi });
    assert.equal(r.status, 200, `login ${email}`);
    return k;
  };
  const selesai = async () => {
    server.closeAllConnections(); server.close();
    await db.tutup();
    await admin.query(`DROP SCHEMA ${skema} CASCADE`);
    await admin.end();
  };
  return { db, origin, klien, divisiId, buatPengguna, masuk, selesai };
}

/** Data kontrak minimal yang valid (divisi diisi pemanggil). */
export const baruBody = (divisi_id, extra = {}) => ({ judul: 'MoU uji', jenis_dokumen: 'MoU', divisi_id, pic_nama: 'Penguji', counterparty_nama: 'Mitra Fiktif', ...extra });
export const lengkap = (extra = {}) => ({
  nomor_kontrak: `UJI/${randomBytes(3).toString('hex')}`, tanggal_ttd: tambahHari(H, -300), tanggal_mulai: tambahHari(H, -300),
  tanggal_berakhir: tambahHari(H, 30), masa_pemberitahuan_hari: 60, ...extra,
});
export const dok = (kategori, nama = 'Dokumen') => ({ kategori, nama, lokasi: `https://drive.example/${kategori}` });
