import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bukaDb } from './db.js';
import { buatApp, jalankanJobHarian } from './app.js';
import { hashSandi } from './sandi.js';
import { hariIni, tambahHari } from './logika.js';

let server, base, db, cookie = '';
const H = hariIni();

async function panggil(metode, path, body) {
  const r = await fetch(base + path, {
    method: metode,
    headers: { 'content-type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return { status: r.status, data: await r.json().catch(() => null) };
}

before(async () => {
  db = bukaDb(':memory:');
  db.prepare('INSERT INTO pengguna (nama, email, sandi_hash) VALUES (?,?,?)').run('Uji', 'uji@example.test', hashSandi('sandi-uji-123'));
  server = buatApp(db).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
});
after(() => { server.closeAllConnections(); server.close(); });

const baru = (extra = {}) => ({ judul: 'MoU uji', jenis_dokumen: 'MoU', divisi_id: 1, pic_nama: 'Penguji', counterparty_nama: 'Mitra Fiktif', ...extra });

test('endpoint butuh login', async () => {
  assert.equal((await panggil('GET', '/kontrak')).status, 401);
  assert.equal((await panggil('GET', '/dashboard')).status, 401);
});

test('login salah ditolak dengan pesan generik, login benar berhasil', async () => {
  const salah = await panggil('POST', '/auth/login', { email: 'uji@example.test', sandi: 'salah' });
  assert.equal(salah.status, 401);
  const tidakAda = await panggil('POST', '/auth/login', { email: 'x@example.test', sandi: 'salah' });
  assert.equal(salah.data.pesan, tidakAda.data.pesan);
  const ok = await panggil('POST', '/auth/login', { email: 'uji@example.test', sandi: 'sandi-uji-123' });
  assert.equal(ok.status, 200);
});

test('alur: draft -> aktif ditolak, lengkap -> aktif, perpanjangan, arsip', async () => {
  const { data: k } = (await panggil('POST', '/kontrak', baru({ ruang_lingkup: 'x' })));
  assert.equal(k.status, 'draft');
  const loncat = await panggil('POST', `/kontrak/${k.id}/transisi`, { ke: 'aktif' });
  assert.equal(loncat.status, 409);

  for (const ke of ["review_legal", "menunggu_ttd"]) { const r = await panggil("POST", `/kontrak/${k.id}/transisi`, { ke }); assert.equal(r.status, 200, JSON.stringify(r.data)); }
  const tanpaDok = await panggil('POST', `/kontrak/${k.id}/transisi`, { ke: 'aktif' });
  assert.equal(tanpaDok.status, 409);

  const ubah = await panggil('PATCH', `/kontrak/${k.id}`, {
    nomor_kontrak: 'UJI/001', tanggal_ttd: tambahHari(H, -300), tanggal_mulai: tambahHari(H, -300), tanggal_berakhir: tambahHari(H, 30),
    masa_pemberitahuan_hari: 60, tautan_dokumen_final: 'https://drive.example/final',
  });
  assert.equal(ubah.status, 200);
  assert.equal((await panggil('POST', `/kontrak/${k.id}/transisi`, { ke: 'aktif' })).status, 200);

  const detail = (await panggil('GET', `/kontrak/${k.id}`)).data;
  assert.equal(detail.tingkat, 'oranye');
  assert.equal(detail.notice_terlewat, true);

  const mundur = await panggil('POST', `/kontrak/${k.id}/perpanjangan`, { tanggal_berakhir_baru: tambahHari(H, 10) });
  assert.equal(mundur.status, 400);
  const lama = detail.tanggal_berakhir;
  const p = await panggil('POST', `/kontrak/${k.id}/perpanjangan`, { tanggal_berakhir_baru: tambahHari(H, 400) });
  assert.equal(p.status, 200);
  assert.equal(p.data.siklus_perpanjangan, 1);
  const d2 = (await panggil('GET', `/kontrak/${k.id}`)).data;
  assert.equal(d2.perpanjangan[0].tanggal_berakhir_lama, lama);
});

test('validasi input: tautan non-https, tanggal salah, nomor duplikat', async () => {
  assert.equal((await panggil('POST', '/kontrak', baru({ tautan_dokumen_final: 'javascript:alert(1)' }))).status, 400);
  assert.equal((await panggil('POST', '/kontrak', baru({ tautan_dokumen_final: 'http://x.example' }))).status, 400);
  assert.equal((await panggil('POST', '/kontrak', baru({ tanggal_mulai: '2026-13-40' }))).status, 400);
  assert.equal((await panggil('POST', '/kontrak', baru({ tanggal_mulai: '2026-05-02', tanggal_berakhir: '2026-05-01' }))).status, 400);
  assert.equal((await panggil('POST', '/kontrak', baru({ nomor_kontrak: 'DUP/1' }))).status, 201);
  assert.equal((await panggil('POST', '/kontrak', baru({ nomor_kontrak: 'DUP/1' }))).status, 409);
});

test('job harian: berakhir otomatis, auto-renew tidak', async () => {
  const mk = (n, otomatis) => db.prepare(`INSERT INTO kontrak (nomor_kontrak, judul, jenis_dokumen, counterparty_id, divisi_id, pic_nama,
    tanggal_mulai, tanggal_berakhir, perpanjangan_otomatis, status, dibuat_pada, diubah_pada)
    VALUES (?, 'J', 'MoU', 1, 1, 'P', ?, ?, ?, 'aktif', 'x', 'x')`).run(n, tambahHari(H, -400), tambahHari(H, -1), otomatis).lastInsertRowid;
  const a = mk('JOB/1', 0); const b = mk('JOB/2', 1);
  assert.ok(jalankanJobHarian(db) >= 1);
  assert.equal(jalankanJobHarian(db), 0); // idempoten
  assert.equal(db.prepare('SELECT status FROM kontrak WHERE id = ?').get(a).status, 'berakhir');
  assert.equal(db.prepare('SELECT status FROM kontrak WHERE id = ?').get(b).status, 'aktif');
});

test('audit_log dan riwayat_status tidak bisa diubah', () => {
  assert.throws(() => db.prepare('DELETE FROM audit_log').run());
  assert.throws(() => db.prepare("UPDATE riwayat_status SET catatan = 'x'").run());
});

test('dashboard mengembalikan kartu dan prioritas', async () => {
  const { status, data } = await panggil('GET', '/dashboard');
  assert.equal(status, 200);
  assert.equal(data.berakhir_per_bulan.length, 12);
  assert.ok(data.kartu.total >= 1);
});
