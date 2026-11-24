// Kelola pengguna, persetujuan peran (empat mata), audit log, dashboard Admin Sistem. PostgreSQL asli.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mulai, SANDI, baruBody, dok } from './uji-bantu.js';

let u; let OPS; let BD;
let sistem; let legal; let pic; let finance; let direksi; let viewer;

before(async () => {
  u = await mulai();
  OPS = await u.divisiId('OPS'); BD = await u.divisiId('BD');
  for (const [e, p, d] of [['legal', 'legal'], ['pic', 'pic', 'AKD'], ['fin', 'finance'], ['dir', 'direksi'], ['viewer', 'viewer'], ['sistem', 'admin_sistem']]) {
    await u.buatPengguna(`${e}@uji.test`, p, d ?? null);
  }
  [legal, pic, finance, direksi, viewer, sistem] = await Promise.all(['legal', 'pic', 'fin', 'dir', 'viewer', 'sistem'].map((n) => u.masuk(`${n}@uji.test`)));
});
after(() => u.selesai());

test('peran non-admin tidak bisa kelola pengguna, divisi, atau melihat dashboard sistem', async () => {
  for (const k of [legal, pic, finance, direksi, viewer]) {
    assert.equal((await k('GET', '/pengguna')).status, 403);
    assert.equal((await k('POST', '/pengguna', { nama: 'x', email: 'x@uji.test', peran: 'viewer' })).status, 403);
    assert.equal((await k('GET', '/admin/ringkasan')).status, 403);
    assert.equal((await k('POST', '/divisi', { kode: 'XX', nama: 'x' })).status, 403);
  }
  assert.equal((await pic('GET', '/audit-log')).status, 403);
  assert.equal((await viewer('GET', '/audit-log')).status, 403);
});

test('buat pengguna: sandi sementara sekali tampil, wajib ganti sebelum bisa bekerja', async () => {
  const r = await sistem('POST', '/pengguna', { nama: 'PIC Baru', email: 'Baru.PIC@uji.test', peran: 'pic', divisi_id: OPS });
  assert.equal(r.status, 201);
  assert.equal(r.data.pengguna.peran, 'pic');
  assert.equal(r.data.menunggu_persetujuan, false);
  assert.equal(r.data.pengguna.sandi_hash, undefined);
  const sementara = r.data.sandi_sementara;
  assert.ok(sementara.length >= 12);

  const k = await u.masuk('baru.pic@uji.test', sementara);
  const blok = await k('GET', '/kontrak');
  assert.equal(blok.status, 403);
  assert.equal(blok.data.kode, 'wajib_ganti_sandi');
  assert.equal((await k('GET', '/auth/saya')).data.wajib_ganti, true);
  assert.equal((await k('POST', '/auth/ganti-sandi', { lama: sementara, baru: 'pendek' })).status, 400);
  assert.equal((await k('POST', '/auth/ganti-sandi', { lama: 'salah-salah-salah', baru: 'sandi-baru-yang-panjang' })).status, 400);
  assert.equal((await k('POST', '/auth/ganti-sandi', { lama: sementara, baru: sementara })).status, 400);
  assert.equal((await k('POST', '/auth/ganti-sandi', { lama: sementara, baru: 'sandi-baru-yang-panjang' })).status, 200);
  assert.equal((await k('GET', '/kontrak')).status, 200);
  assert.ok((await k('GET', '/kontrak')).data.data.every((x) => x.divisi_id === OPS));
  assert.equal((await u.db.satu('SELECT count(*)::int AS n FROM audit_log WHERE ringkasan LIKE $1', [`%${sementara}%`])).n, 0, 'sandi sementara tidak boleh masuk audit log');
  await assert.rejects(() => u.masuk('baru.pic@uji.test', sementara)); // sandi sementara tidak berlaku lagi
});

test('validasi pengguna: email ganda, peran salah, PIC tanpa divisi, divisi tidak aktif', async () => {
  assert.equal((await sistem('POST', '/pengguna', { nama: 'A', email: 'legal@uji.test', peran: 'viewer' })).status, 409);
  assert.equal((await sistem('POST', '/pengguna', { nama: 'A', email: 'a1@uji.test', peran: 'dewa' })).status, 400);
  assert.equal((await sistem('POST', '/pengguna', { nama: 'A', email: 'a2@uji.test', peran: 'pic' })).status, 400);
  assert.equal((await sistem('POST', '/pengguna', { nama: 'A', email: 'bukan-email', peran: 'viewer' })).status, 400);
  const { data: d } = await sistem('POST', '/divisi', { kode: 'TMP', nama: 'Sementara' });
  await sistem('PATCH', `/divisi/${d.id}`, { aktif: false });
  assert.equal((await sistem('POST', '/pengguna', { nama: 'A', email: 'a3@uji.test', peran: 'pic', divisi_id: d.id })).status, 400);
});

test('peran istimewa butuh persetujuan Admin Sistem lain (empat mata)', async () => {
  const r = await sistem('POST', '/pengguna', { nama: 'Calon Legal', email: 'calon@uji.test', peran: 'legal' });
  assert.equal(r.status, 201);
  assert.equal(r.data.menunggu_persetujuan, true);
  assert.equal(r.data.pengguna.peran, 'viewer'); // belum berlaku
  const id = r.data.pengguna.id;
  const antrian = (await sistem('GET', '/pengguna')).data.permintaan.find((p) => p.pengguna_id === id);
  assert.equal(antrian.peran_baru, 'legal');
  assert.equal((await sistem('POST', `/permintaan-peran/${antrian.id}/setujui`)).status, 403); // pemohon tidak boleh menyetujui sendiri
  assert.equal((await sistem('PATCH', `/pengguna/${id}`, { peran: 'finance' })).status, 409); // permintaan ganda ditolak
  await u.buatPengguna('sistem2@uji.test', 'admin_sistem');
  const dua = await u.masuk('sistem2@uji.test');
  assert.equal((await dua('POST', `/permintaan-peran/${antrian.id}/setujui`)).status, 200);
  assert.equal((await u.db.satu('SELECT peran FROM pengguna WHERE id = $1', [id])).peran, 'legal');
  assert.equal((await dua('POST', `/permintaan-peran/${antrian.id}/setujui`)).status, 404); // sudah diputuskan

  // Perubahan peran biasa langsung berlaku; tidak bisa mengubah diri sendiri.
  const vid = (await u.db.satu("SELECT id FROM pengguna WHERE email = 'viewer@uji.test'")).id;
  assert.equal((await sistem('PATCH', `/pengguna/${vid}`, { peran: 'pic', divisi_id: BD })).status, 200);
  assert.equal((await u.db.satu('SELECT peran FROM pengguna WHERE id = $1', [vid])).peran, 'pic');
  await u.db.jalankan("UPDATE pengguna SET peran = 'viewer', divisi_id = NULL WHERE id = $1", [vid]);
  const sid = (await u.db.satu("SELECT id FROM pengguna WHERE email = 'sistem@uji.test'")).id;
  assert.equal((await sistem('PATCH', `/pengguna/${sid}`, { peran: 'viewer' })).status, 403);

  const r2 = await sistem('POST', '/pengguna', { nama: 'Calon Dua', email: 'calon2@uji.test', peran: 'direksi' });
  const a2 = (await sistem('GET', '/pengguna')).data.permintaan.find((p) => p.pengguna_id === r2.data.pengguna.id);
  assert.equal((await dua('POST', `/permintaan-peran/${a2.id}/tolak`)).status, 200);
  assert.equal((await u.db.satu('SELECT peran FROM pengguna WHERE id = $1', [r2.data.pengguna.id])).peran, 'viewer');
});

test('dua permintaan persetujuan bersamaan: hanya satu yang berlaku', async () => {
  const r = await sistem('POST', '/pengguna', { nama: 'Calon Balap', email: 'balap@uji.test', peran: 'finance' });
  const a = (await sistem('GET', '/pengguna')).data.permintaan.find((p) => p.pengguna_id === r.data.pengguna.id);
  const dua = await u.masuk('sistem2@uji.test');
  await u.buatPengguna('sistem3@uji.test', 'admin_sistem');
  const tiga = await u.masuk('sistem3@uji.test');
  const hasil = await Promise.all([dua('POST', `/permintaan-peran/${a.id}/setujui`), tiga('POST', `/permintaan-peran/${a.id}/tolak`)]);
  assert.deepEqual(hasil.map((x) => x.status).sort(), [200, 409]);
  assert.equal((await u.db.satu("SELECT count(*)::int AS n FROM audit_log WHERE aksi IN ('peran_disetujui','peran_ditolak') AND objek_id = $1", [r.data.pengguna.id])).n, 1);
});

test('menonaktifkan pengguna memutus sesi aktifnya; reset sandi mematikan sandi lama', async () => {
  const id = await u.buatPengguna('korban@uji.test', 'viewer');
  const k = await u.masuk('korban@uji.test');
  assert.equal((await k('GET', '/kontrak')).status, 200);
  assert.equal((await sistem('PATCH', `/pengguna/${id}`, { aktif: false })).status, 200);
  assert.equal((await k('GET', '/kontrak')).status, 401); // sesi lama langsung mati
  assert.equal((await u.klien()('POST', '/auth/login', { email: 'korban@uji.test', sandi: SANDI })).status, 401);
  assert.equal((await sistem('PATCH', `/pengguna/${id}`, { aktif: true })).status, 200);

  const rs = await sistem('POST', `/pengguna/${id}/reset-sandi`);
  assert.equal(rs.status, 200);
  assert.equal((await u.klien()('POST', '/auth/login', { email: 'korban@uji.test', sandi: SANDI })).status, 401);
  assert.equal((await u.klien()('POST', '/auth/login', { email: 'korban@uji.test', sandi: rs.data.sandi_sementara })).status, 200);
  const sid = (await u.db.satu("SELECT id FROM pengguna WHERE email = 'sistem@uji.test'")).id;
  assert.equal((await sistem('POST', `/pengguna/${sid}/reset-sandi`)).status, 403);
  assert.equal((await sistem('PATCH', `/pengguna/${sid}`, { aktif: false })).status, 403);
});

test('akun demo tidak dapat diubah, direset, atau ganti sandi', async () => {
  const id = (await u.db.satu("INSERT INTO pengguna (nama, email, sandi_hash, peran, demo) VALUES ('Demo X', 'x@demo.test', 'x:y', 'viewer', true) RETURNING id")).id;
  assert.equal((await sistem('PATCH', `/pengguna/${id}`, { aktif: false })).status, 403);
  assert.equal((await sistem('PATCH', `/pengguna/${id}`, { peran: 'pic', divisi_id: OPS })).status, 403);
  assert.equal((await sistem('POST', `/pengguna/${id}/reset-sandi`)).status, 403);
});

test('divisi: Admin Sistem menambah, mengubah, menonaktifkan; kode ganda ditolak', async () => {
  assert.equal((await sistem('POST', '/divisi', { kode: 'x', nama: 'Salah' })).status, 400);
  const r = await sistem('POST', '/divisi', { kode: 'hr', nama: 'Human Resources' });
  assert.equal(r.status, 201); assert.equal(r.data.kode, 'HR');
  assert.equal((await sistem('POST', '/divisi', { kode: 'HR', nama: 'Lagi' })).status, 409);
  assert.equal((await sistem('PATCH', `/divisi/${r.data.id}`, { nama: 'SDM' })).status, 200);
  assert.ok((await sistem('GET', '/master')).data.divisi.some((d) => d.nama === 'SDM'));
  await sistem('PATCH', `/divisi/${r.data.id}`, { aktif: false });
  assert.ok(!(await sistem('GET', '/master')).data.divisi.some((d) => d.nama === 'SDM')); // tidak lagi muncul di pilihan
  assert.ok((await sistem('GET', '/divisi')).data.some((d) => d.kode === 'HR' && d.aktif === false));
});

test('dashboard Admin Sistem: kesehatan sistem tanpa isi kontrak', async () => {
  const { data: k } = await legal('POST', '/kontrak', baruBody(OPS, { judul: 'Rahasia Judul Kontrak', counterparty_nama: 'Mitra Rahasia', nilai_kontrak: '777000' }));
  await legal('POST', `/kontrak/${k.id}/dokumen`, dok('draft'));
  const { status, data } = await sistem('GET', '/admin/ringkasan');
  assert.equal(status, 200);
  assert.ok(data.pengguna.aktif >= 8);
  assert.equal(data.pengguna.per_peran.length, 6);
  assert.ok(data.keamanan_24_jam.login_berhasil >= 1);
  assert.ok(data.keamanan_24_jam.akses_ditolak >= 1);
  assert.equal(data.sistem.database, 'PostgreSQL');
  const teks = JSON.stringify(data);
  assert.ok(!/Rahasia Judul|Mitra Rahasia|777000/.test(teks), 'tidak boleh memuat judul, counterparty, atau nilai');
  assert.equal(data.kartu, undefined);
});

test('audit log: Admin Sistem melihat log keamanan, Legal melihat log kontrak', async () => {
  const a = (await sistem('GET', '/audit-log')).data;
  assert.ok(a.data.length > 0 && a.data.every((x) => a.aksi.includes(x.aksi)));
  assert.ok(a.data.some((x) => x.aksi === 'login'));
  assert.ok(!a.data.some((x) => x.aksi === 'kontrak_dibuat'));
  const l = (await legal('GET', '/audit-log')).data;
  assert.ok(l.data.some((x) => x.aksi === 'kontrak_dibuat'));
  assert.ok(!l.data.some((x) => x.aksi === 'login' || x.aksi === 'pengguna_dibuat'));
  const bocor = (await legal('GET', '/audit-log?aksi=login')).data; // filter di luar jatah diabaikan, bukan dibocorkan
  assert.ok(bocor.data.every((x) => x.aksi !== 'login'));
  // Audit log kontrak tidak memuat nilai.
  assert.ok(!JSON.stringify(l).includes('777000'));
});
