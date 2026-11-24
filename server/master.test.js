// Aturan reminder, pengaturan bisnis, dan ekspor CSV. PostgreSQL asli.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mulai, baruBody, dok, lengkap, H, tambahHari } from './uji-bantu.js';

let u; let AKD; let BD;
let legal; let pic; let finance; let direksi; let viewer; let sistem;

before(async () => {
  u = await mulai();
  AKD = await u.divisiId('AKD'); BD = await u.divisiId('BD');
  for (const [e, p, d] of [['legal', 'legal'], ['pic', 'pic', 'AKD'], ['fin', 'finance'], ['dir', 'direksi'], ['viewer', 'viewer'], ['sistem', 'admin_sistem']]) {
    await u.buatPengguna(`${e}@uji.test`, p, d ?? null);
  }
  [legal, pic, finance, direksi, viewer, sistem] = await Promise.all(['legal', 'pic', 'fin', 'dir', 'viewer', 'sistem'].map((n) => u.masuk(`${n}@uji.test`)));
});
after(() => u.selesai());

test('aturan reminder dan pengaturan hanya untuk Legal', async () => {
  for (const k of [pic, finance, direksi, viewer, sistem]) {
    assert.equal((await k('GET', '/aturan-reminder')).status, 403);
    assert.equal((await k('POST', '/aturan-reminder', { acuan: 'berakhir', hari_sebelum: 14, peran_penerima: 'pic' })).status, 403);
    assert.equal((await k('GET', '/pengaturan')).status, 403);
    assert.equal((await k('PATCH', '/pengaturan', { ambang_direksi: '1' })).status, 403);
  }
  const a = (await legal('GET', '/aturan-reminder')).data;
  assert.equal(a.length, 14);
  assert.ok(a.some((x) => x.acuan === 'berakhir' && x.hari_sebelum === 120 && x.peran_penerima === 'pic'));
});

test('aturan reminder: tambah, ubah, nonaktifkan, validasi', async () => {
  const r = await legal('POST', '/aturan-reminder', { acuan: 'berakhir', hari_sebelum: 14, peran_penerima: 'legal' });
  assert.equal(r.status, 201); assert.equal(r.data.aktif, true);
  for (const salah of [{ hari_sebelum: 0 }, { hari_sebelum: 99999 }, { hari_sebelum: 1.5 }, { acuan: 'lain' }, { peran_penerima: 'viewer' }]) {
    assert.equal((await legal('POST', '/aturan-reminder', { acuan: 'berakhir', hari_sebelum: 14, peran_penerima: 'pic', ...salah })).status, 400, JSON.stringify(salah));
  }
  assert.equal((await legal('POST', '/aturan-reminder', { acuan: 'berakhir' })).status, 400);
  const p = await legal('PATCH', `/aturan-reminder/${r.data.id}`, { hari_sebelum: 21, aktif: false });
  assert.equal(p.data.hari_sebelum, 21); assert.equal(p.data.aktif, false);
  assert.equal((await legal('PATCH', '/aturan-reminder/999999', { aktif: false })).status, 404);
  assert.equal((await legal('PATCH', `/aturan-reminder/${r.data.id}`, {})).status, 400);
  assert.equal((await legal('DELETE', `/aturan-reminder/${r.data.id}`)).status, 404); // tidak ada hapus
});

test('pengaturan: validasi ambang hari, ambang Direksi, dan domain tautan; perubahan tercatat tanpa nilai', async () => {
  assert.equal((await legal('PATCH', '/pengaturan', { batas_kuning_hari: 50 })).status, 400); // harus > oranye (90)
  assert.equal((await legal('PATCH', '/pengaturan', { batas_oranye_hari: 0 })).status, 400);
  assert.equal((await legal('PATCH', '/pengaturan', { ambang_direksi: '-1' })).status, 400);
  assert.equal((await legal('PATCH', '/pengaturan', { ambang_direksi: 'banyak' })).status, 400);
  assert.equal((await legal('PATCH', '/pengaturan', { domain_tautan_diizinkan: '' })).status, 400);
  assert.equal((await legal('PATCH', '/pengaturan', { domain_tautan_diizinkan: 'bukan domain, javascript:x' })).status, 400);
  const r = await legal('PATCH', '/pengaturan', { batas_kuning_hari: 200, ambang_direksi: '750000000', domain_tautan_diizinkan: ' Drive.Example , docs.example,drive.example' });
  assert.equal(r.status, 200);
  assert.equal(r.data.batas_kuning_hari, '200');
  assert.equal(r.data.domain_tautan_diizinkan, 'drive.example,docs.example'); // dinormalkan dan tanpa duplikat
  const log = await u.db.satu("SELECT ringkasan FROM audit_log WHERE aksi = 'pengaturan_diubah' ORDER BY id DESC LIMIT 1");
  assert.match(log.ringkasan, /ambang_direksi/);
  assert.ok(!log.ringkasan.includes('750000000'), 'nilai ambang tidak ditulis ke audit log');
  await legal('PATCH', '/pengaturan', { batas_kuning_hari: 180, ambang_direksi: '0' });
});

test('domain tautan yang diubah langsung berlaku untuk dokumen baru', async () => {
  const { data: k } = await legal('POST', '/kontrak', baruBody(AKD));
  const lokasi = 'https://contoh.sharepoint.com/x';
  assert.equal((await legal('POST', `/kontrak/${k.id}/dokumen`, { kategori: 'draft', nama: 'x', lokasi })).status, 400);
  await legal('PATCH', '/pengaturan', { domain_tautan_diizinkan: 'drive.example,sharepoint.com' });
  assert.equal((await legal('POST', `/kontrak/${k.id}/dokumen`, { kategori: 'draft', nama: 'x', lokasi })).status, 201);
  await legal('PATCH', '/pengaturan', { domain_tautan_diizinkan: 'drive.example,docs.example' });
});

// ---------- Ekspor ----------

const csv = async (k, qs = '') => {
  const r = await k.mentah('GET', `/laporan/ekspor${qs}`);
  // Buffer.toString mempertahankan BOM; Response.text() membuangnya sehingga BOM tidak bisa diperiksa.
  const bytes = Buffer.from(await r.arrayBuffer());
  return { status: r.status, tipe: r.headers.get('content-type'), disp: r.headers.get('content-disposition'), teks: bytes.toString('utf8'), bom: bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) };
};

test('ekspor CSV: netralkan rumus, nilai hanya untuk peran berhak, Finance hanya data bernilai, tercatat di audit', async () => {
  const buat = async (judul, extra) => {
    const { data: k } = await legal('POST', '/kontrak', baruBody(AKD, { judul, ...extra }));
    return k.id;
  };
  await buat('=HYPERLINK("http://jahat.example","klik")', { nilai_kontrak: '111222333' });
  await buat('+cmd|calc', {});
  await buat('@SUM(A1)', {});
  await buat('Judul, dengan "koma" dan kutip', { nilai_kontrak: '444555666' });

  const l = await csv(legal);
  assert.equal(l.status, 200);
  assert.match(l.tipe, /text\/csv/); assert.match(l.disp, /attachment; filename="kontrak-\d{4}-\d{2}-\d{2}\.csv"/);
  assert.equal(l.bom, true, 'BOM UTF-8 agar Excel membaca huruf dengan benar');
  for (const bahaya of ['=HYPERLINK', '+cmd', '@SUM']) {
    assert.ok(l.teks.includes(`'${bahaya}`), `${bahaya} harus diberi apostrof`);
    assert.ok(!new RegExp(`(^|,|\\n)${bahaya.replace(/[+=@|()]/g, (c) => `\\${c}`)}`).test(l.teks), `${bahaya} tidak boleh di awal sel`);
  }
  assert.ok(l.teks.includes('"Judul, dengan ""koma"" dan kutip"'), 'koma dan kutip di-escape');
  assert.ok(l.teks.includes('Nilai kontrak') && l.teks.includes('111222333'));

  const p = await csv(pic);
  assert.equal(p.status, 200);
  assert.ok(!p.teks.includes('Nilai kontrak') && !p.teks.includes('111222333') && !p.teks.includes('444555666'), 'PIC tanpa nilai');
  const f = await csv(finance);
  assert.ok(f.teks.includes('111222333') && f.teks.includes('444555666'));
  assert.ok(!f.teks.includes('+cmd') && !f.teks.includes('@SUM'), 'Finance hanya kontrak bernilai');
  assert.ok((await csv(direksi)).teks.includes('Nilai kontrak'));
  assert.equal((await csv(viewer)).status, 403);
  assert.equal((await csv(sistem)).status, 403);

  const filter = await csv(legal, '?q=cmd');
  assert.ok(filter.teks.includes('cmd') && !filter.teks.includes('Judul, dengan'), 'ekspor mengikuti filter yang sama dengan daftar');
  const log = await u.db.satu("SELECT ringkasan FROM audit_log WHERE aksi = 'ekspor' ORDER BY id DESC LIMIT 1");
  assert.match(log.ringkasan, /baris=\d+/);
  assert.ok(!log.ringkasan.includes('111222333'));
});

test('ekspor PIC hanya divisinya sendiri', async () => {
  await legal('POST', '/kontrak', baruBody(BD, { judul: 'Milik BD rahasia' }));
  const p = await csv(pic);
  assert.ok(!p.teks.includes('Milik BD rahasia'));
});
