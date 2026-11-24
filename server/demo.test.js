// Mode demo, login satu klik, data demo, pembatas login, bootstrap. PostgreSQL asli.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mulai, SANDI } from './uji-bantu.js';
import { isiDemo } from './demo.js';
import { cocokSandi } from './sandi.js';
import { jalankanReminder } from './jobs.js';

let u;
before(async () => {
  delete process.env.DEMO_MODE;
  u = await mulai();
  await u.buatPengguna('biasa@uji.test', 'legal');
});
after(() => { delete process.env.DEMO_MODE; return u.selesai(); });

test('mode demo mati: daftar kosong dan login demo tidak ada', async () => {
  const k = u.klien();
  assert.deepEqual((await k('GET', '/demo/akun')).data, { aktif: false, akun: [] });
  assert.equal((await k('POST', '/auth/demo', { id: 1 })).status, 404);
});

test('data demo: 9 akun (Super Admin, Legal, HQ/TEN, Finance, 3 unit, Auditor), kontrak mencakup semua tahap, idempoten, tanpa kata sandi yang bisa ditebak', async () => {
  assert.equal(await u.db.tx((t) => isiDemo(t)), true);
  assert.equal(await u.db.tx((t) => isiDemo(t)), false); // idempoten
  const akun = await u.db.q('SELECT email, peran, sandi_hash, wajib_ganti FROM pengguna WHERE demo ORDER BY id');
  assert.deepEqual(akun.map((a) => a.peran).sort(), ['admin_sistem', 'direksi', 'finance', 'legal', 'legal', 'pic', 'pic', 'pic', 'viewer']);
  assert.ok(akun.every((a) => a.email.endsWith('@demo.test') && !a.wajib_ganti));
  for (const tebakan of ['demo', 'password', 'demo-partnership-ten', SANDI, 'admin', '12345678', '']) {
    for (const a of akun) assert.equal(cocokSandi(tebakan, a.sandi_hash), false, `${a.email} / ${tebakan}`);
  }
  assert.equal(new Set(akun.map((a) => a.sandi_hash)).size, akun.length, 'tiap akun punya hash acak sendiri');
  const status = (await u.db.q('SELECT DISTINCT status FROM kontrak')).map((x) => x.status);
  for (const s of ['draft', 'review_legal', 'review_finance', 'persetujuan_direksi', 'menunggu_ttd', 'aktif', 'negosiasi_perpanjangan', 'berakhir']) assert.ok(status.includes(s), s);
  // Semua kontrak aktif punya dokumen final; semua di luar draft punya draft (aturan bisnis terpenuhi oleh data demo).
  assert.equal((await u.db.satu("SELECT count(*)::int AS n FROM kontrak k WHERE status IN ('aktif','negosiasi_perpanjangan','berakhir') AND NOT EXISTS (SELECT 1 FROM dokumen d WHERE d.kontrak_id = k.id AND d.kategori = 'final_ttd')")).n, 0);
  assert.ok(!JSON.stringify(await u.db.q('SELECT * FROM kontrak')).match(/npwp|@(gmail|yahoo)\./i), 'tanpa data nyata');
  assert.ok((await jalankanReminder(u.db)).notifikasi_baru > 0); // lonceng demo berisi
});

test('login demo satu klik: hanya saat DEMO_MODE=1, hanya akun demo, tercatat di audit', async () => {
  process.env.DEMO_MODE = '1';
  const k = u.klien();
  const d = (await k('GET', '/demo/akun')).data;
  assert.equal(d.aktif, true);
  assert.equal(d.akun.length, 9);
  assert.deepEqual(d.akun.map((a) => a.peran), ['admin_sistem', 'legal', 'legal', 'direksi', 'finance', 'pic', 'pic', 'pic', 'viewer']); // urut kartu
  assert.deepEqual(d.akun.filter((a) => a.peran === 'pic').map((a) => a.peran_label), ['Unit Tgn & Tlc', 'Unit Upitra', 'Unit Cristore']);
  assert.ok(d.akun.every((a) => a.ringkas && a.peran_label && a.email === undefined), 'email tidak dibocorkan');

  const biasa = (await u.db.satu("SELECT id FROM pengguna WHERE email = 'biasa@uji.test'")).id;
  assert.equal((await k('POST', '/auth/demo', { id: biasa })).status, 404, 'akun non-demo tidak bisa dimasuki lewat jalur demo');
  assert.equal((await k('POST', '/auth/demo', { id: 'bukan-angka' })).status, 404);
  assert.equal((await k('POST', '/auth/demo', {})).status, 404);

  for (const a of d.akun) {
    const kl = u.klien();
    const r = await kl('POST', '/auth/demo', { id: a.id });
    assert.equal(r.status, 200, a.peran);
    assert.equal(r.data.peran, a.peran); assert.equal(r.data.demo, true);
    assert.equal((await kl('GET', '/auth/saya')).data.peran, a.peran);
  }
  assert.ok((await u.db.satu("SELECT count(*)::int AS n FROM audit_log WHERE aksi = 'login_demo'")).n >= 9);

  // Matriks hak akses tetap berlaku untuk akun demo.
  const per = async (peran) => { const kl = u.klien(); await kl('POST', '/auth/demo', { id: d.akun.find((a) => a.peran === peran).id }); return kl; };
  const sistem = await per('admin_sistem');
  assert.equal((await sistem('GET', '/kontrak')).status, 403);
  assert.equal((await sistem('GET', '/pengguna')).status, 200);
  const picUnit = async (nama) => { const kl = u.klien(); await kl('POST', '/auth/demo', { id: d.akun.find((a) => a.nama === `${nama} Demo`).id }); return kl; };
  const pic = await picUnit('PIC Tgn & Tlc');
  const daftar = (await pic('GET', '/kontrak')).data;
  assert.ok(daftar.total >= 1 && daftar.data.every((x) => x.divisi_nama === 'Tgn & Tlc'));
  for (const [nama, unit] of [['PIC Upitra', 'Upitra'], ['PIC Cristore', 'Cristore']]) {
    const dl = (await (await picUnit(nama))('GET', '/kontrak')).data;
    assert.ok(dl.total >= 1 && dl.data.every((x) => x.divisi_nama === unit), nama);
    const dr = dl.data.find((x) => x.status === 'draft');
    if (dr) assert.deepEqual(dr.transisi_tersedia, ['review_legal', 'dibatalkan']);
  }
  const legalDemo = await per('legal');
  const rl = (await legalDemo('GET', '/kontrak?status=review_legal')).data.data[0];
  assert.deepEqual(rl.transisi_tersedia, ['draft', 'review_finance']); // nilai > 0: wajib lewat Finance, tidak bisa loncat
  // Daftar membawa menu status yang sah per baris: PIC hanya bisa mengajukan draft ke Legal atau membatalkan.
  const draftPic = daftar.data.find((x) => x.status === 'draft');
  if (draftPic) assert.deepEqual(draftPic.transisi_tersedia, ['review_legal', 'dibatalkan']);
  assert.ok(daftar.data.every((x) => Array.isArray(x.transisi_tersedia)));
  assert.ok(!JSON.stringify(daftar).includes('nilai_kontrak'));
  const finance = await per('finance');
  assert.ok((await finance('GET', '/dashboard')).data.nilai_aktif.length > 0);
  const direksi = await per('direksi');
  assert.ok((await direksi('GET', '/dashboard')).data.kartu.menunggu_anda >= 1, 'Direksi punya antrian persetujuan di demo');

  // Akun demo tidak bisa dirusak.
  assert.equal((await pic('POST', '/auth/ganti-sandi', { lama: 'x', baru: 'sandi-baru-yang-panjang' })).status, 403);
  const vid = d.akun.find((a) => a.peran === 'viewer').id;
  assert.equal((await sistem('PATCH', `/pengguna/${vid}`, { aktif: false })).status, 403);
  assert.equal((await sistem('POST', `/pengguna/${vid}/reset-sandi`)).status, 403);
  delete process.env.DEMO_MODE;
  assert.equal((await u.klien()('POST', '/auth/demo', { id: vid })).status, 404, 'mati lagi saat DEMO_MODE dimatikan');
});

test('alur persetujuan demo bisa dijalankan sampai selesai oleh akun yang tepat', async () => {
  process.env.DEMO_MODE = '1';
  try {
    const akun = (await u.klien()('GET', '/demo/akun')).data.akun;
    const per = async (peran) => { const kl = u.klien(); await kl('POST', '/auth/demo', { id: akun.find((a) => a.peran === peran).id }); return kl; };
    const [legal, finance, direksi] = [await per('legal'), await per('finance'), await per('direksi')];
    const T = (k, id, ke) => k('POST', `/kontrak/${id}/transisi`, { ke });

    const fin = (await u.db.satu("SELECT id FROM kontrak WHERE status = 'review_finance'")).id;
    assert.equal((await T(legal, fin, 'menunggu_ttd')).status, 403); // bukan tahap Legal lagi
    assert.equal((await T(finance, fin, 'persetujuan_direksi')).status, 409); // risiko sedang, ambang Direksi nonaktif
    assert.equal((await T(finance, fin, 'menunggu_ttd')).status, 200);

    const dir = (await u.db.satu("SELECT id FROM kontrak WHERE status = 'persetujuan_direksi'")).id;
    assert.equal((await T(finance, dir, 'menunggu_ttd')).status, 403);
    assert.equal((await T(direksi, dir, 'menunggu_ttd')).status, 200);
    assert.equal((await direksi('GET', `/kontrak/${dir}`)).data.persetujuan[0].tahap, 'direksi');
  } finally { delete process.env.DEMO_MODE; }
});

test('pembatas login: 10 percobaan gagal per IP, lalu 429; login berhasil tidak dihitung', async () => {
  const k = u.klien();
  for (let i = 0; i < 3; i++) assert.equal((await k('POST', '/auth/login', { email: 'biasa@uji.test', sandi: SANDI })).status, 200);
  const salah = () => k('POST', '/auth/login', { email: 'biasa@uji.test', sandi: 'salah' });
  const awal = (await u.db.satu("SELECT count(*)::int AS n FROM audit_log WHERE aksi = 'login_gagal'")).n;
  for (let i = awal; i < 10; i++) assert.equal((await salah()).status, 401);
  assert.equal((await salah()).status, 429);
  assert.equal((await k('POST', '/auth/login', { email: 'biasa@uji.test', sandi: SANDI })).status, 429, 'IP yang diblokir tidak bisa login walau sandinya benar');
});
