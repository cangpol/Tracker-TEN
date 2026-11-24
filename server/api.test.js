// Inti: alur kontrak, dokumen, persetujuan berjenjang, nilai per peran, hak akses, cakupan divisi. PostgreSQL asli.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mulai, H, tambahHari, baruBody, lengkap, dok } from './uji-bantu.js';

let u; let AKD; let BD;
let legal; let legal2; let pic; let picBD; let finance; let direksi; let viewer; let sistem;

const baru = (extra = {}) => baruBody(AKD, extra);

before(async () => {
  u = await mulai();
  AKD = await u.divisiId('AKD'); BD = await u.divisiId('BD');
  await u.buatPengguna('legal@uji.test', 'legal'); await u.buatPengguna('legal2@uji.test', 'legal');
  await u.buatPengguna('pic@uji.test', 'pic', 'AKD'); await u.buatPengguna('picbd@uji.test', 'pic', 'BD');
  await u.buatPengguna('fin@uji.test', 'finance'); await u.buatPengguna('dir@uji.test', 'direksi');
  await u.buatPengguna('viewer@uji.test', 'viewer'); await u.buatPengguna('sistem@uji.test', 'admin_sistem');
  [legal, legal2, pic, picBD, finance, direksi, viewer, sistem] = await Promise.all(
    ['legal', 'legal2', 'pic', 'picbd', 'fin', 'dir', 'viewer', 'sistem'].map((n) => u.masuk(`${n}@uji.test`)));
});
after(() => u.selesai());

const T = (k, id, ke, catatan) => k('POST', `/kontrak/${id}/transisi`, { ke, catatan });

/** Kontrak sampai Review Legal (sudah punya draft). */
async function sampaiReviewLegal(extra = {}) {
  const { data: k, status } = await legal('POST', '/kontrak', baru({ ruang_lingkup: 'x', ...extra }));
  assert.equal(status, 201);
  assert.equal((await legal('POST', `/kontrak/${k.id}/dokumen`, dok('draft'))).status, 201);
  assert.equal((await T(legal, k.id, 'review_legal')).status, 200);
  return k.id;
}

/** Kontrak aktif lewat jalur resmi (dua Legal berbeda karena aturan penyetuju). */
async function kontrakAktif(extra = {}) {
  const id = await sampaiReviewLegal(extra);
  assert.equal((await T(legal2, id, 'menunggu_ttd')).status, 200);
  assert.equal((await legal('PATCH', `/kontrak/${id}`, lengkap())).status, 200);
  assert.equal((await legal('POST', `/kontrak/${id}/dokumen`, dok('final_ttd'))).status, 201);
  assert.equal((await T(legal, id, 'aktif')).status, 200);
  return id;
}

test('endpoint butuh login', async () => {
  const anon = u.klien();
  for (const p of ['/kontrak', '/dashboard', '/pengguna', '/notifikasi', '/laporan/ekspor', '/pengaturan', '/aturan-reminder']) {
    assert.equal((await anon('GET', p)).status, 401, p);
  }
});

test('login salah: pesan generik; benar: profil berisi peran dan izin tanpa hash', async () => {
  const salah = await u.klien()('POST', '/auth/login', { email: 'legal@uji.test', sandi: 'salah' });
  const tidakAda = await u.klien()('POST', '/auth/login', { email: 'x@uji.test', sandi: 'salah' });
  assert.equal(salah.status, 401);
  assert.equal(salah.data.pesan, tidakAda.data.pesan);
  const ok = await u.klien()('POST', '/auth/login', { email: 'legal@uji.test', sandi: 'sandi-uji-12345' });
  assert.equal(ok.data.peran, 'legal');
  assert.ok(ok.data.izin.includes('tambah_kontrak') && ok.data.izin.includes('lihat_nilai'));
  assert.ok(!ok.data.izin.includes('kelola_pengguna'));
  assert.equal(ok.data.sandi_hash, undefined);
});

test('sesi disimpan di PostgreSQL dan hilang saat logout', async () => {
  const k = await u.masuk('viewer@uji.test');
  assert.ok((await u.db.satu('SELECT count(*)::int AS n FROM sesi')).n >= 1);
  const sebelum = (await u.db.satu('SELECT count(*)::int AS n FROM sesi')).n;
  assert.equal((await k('POST', '/auth/logout')).status, 200);
  assert.equal((await u.db.satu('SELECT count(*)::int AS n FROM sesi')).n, sebelum - 1);
  assert.equal((await k('GET', '/kontrak')).status, 401);
});

// ---------- Alur dan dokumen ----------

test('alur lengkap dengan syarat dokumen: draft -> aktif -> perpanjangan', async () => {
  const { data: k } = await legal('POST', '/kontrak', baru({ ruang_lingkup: 'x' }));
  assert.equal(k.status, 'draft');
  assert.equal((await T(legal, k.id, 'aktif')).status, 409); // loncat
  const tanpaDraft = await T(legal, k.id, 'review_legal');
  assert.equal(tanpaDraft.status, 409);
  assert.match(tanpaDraft.data.pesan, /draft/);
  await legal('POST', `/kontrak/${k.id}/dokumen`, dok('draft'));
  assert.equal((await T(legal, k.id, 'review_legal')).status, 200);
  assert.equal((await T(legal2, k.id, 'menunggu_ttd')).status, 200);
  const tanpaFinal = await T(legal, k.id, 'aktif');
  assert.equal(tanpaFinal.status, 409);
  assert.match(tanpaFinal.data.pesan, /final/);
  await legal('PATCH', `/kontrak/${k.id}`, lengkap());
  await legal('POST', `/kontrak/${k.id}/dokumen`, dok('final_ttd'));
  assert.equal((await T(legal, k.id, 'aktif')).status, 200);

  const d = (await legal('GET', `/kontrak/${k.id}`)).data;
  assert.equal(d.tingkat, 'oranye');
  assert.equal(d.notice_terlewat, true);
  assert.equal((await legal('POST', `/kontrak/${k.id}/perpanjangan`, { tanggal_berakhir_baru: tambahHari(H, 10) })).status, 400);
  const p = await legal('POST', `/kontrak/${k.id}/perpanjangan`, { tanggal_berakhir_baru: tambahHari(H, 400) });
  assert.equal(p.status, 200);
  assert.equal(p.data.siklus_perpanjangan, 1);
  assert.equal((await legal('GET', `/kontrak/${k.id}`)).data.perpanjangan[0].tanggal_berakhir_lama, d.tanggal_berakhir);
});

test('validasi input kontrak: tanggal, nomor ganda, bentuk data', async () => {
  assert.equal((await legal('POST', '/kontrak', baru({ tanggal_mulai: '2026-13-40' }))).status, 400);
  assert.equal((await legal('POST', '/kontrak', baru({ tanggal_mulai: '2026-05-02', tanggal_berakhir: '2026-05-01' }))).status, 400);
  assert.equal((await legal('POST', '/kontrak', baru({ jenis_dokumen: 'XYZ' }))).status, 400);
  assert.equal((await legal('POST', '/kontrak', baru({ masa_pemberitahuan_hari: -1 }))).status, 400);
  assert.equal((await legal('POST', '/kontrak', baru({ nomor_kontrak: 'DUP/1' }))).status, 201);
  assert.equal((await legal('POST', '/kontrak', baru({ nomor_kontrak: 'DUP/1' }))).status, 409);
  assert.equal((await legal('POST', '/kontrak', baru({ judul: 'x'.repeat(300) }))).status, 400);
});

test('dokumen: versi otomatis, tautan berbahaya ditolak, buka lewat server tercatat di audit', async () => {
  const { data: k } = await legal('POST', '/kontrak', baru({ judul: 'Uji dokumen' }));
  const v1 = await legal('POST', `/kontrak/${k.id}/dokumen`, dok('draft', 'Draf 1'));
  const v2 = await legal('POST', `/kontrak/${k.id}/dokumen`, dok('draft', 'Draf 2'));
  assert.equal(v1.data.versi, 1); assert.equal(v2.data.versi, 2);
  for (const lokasi of ['javascript:alert(1)', 'data:text/html,x', 'http://drive.example/x', 'https://evil.example/x', 'https://user:pw@drive.example/x', 'bukan url', 'https://drive.example.evil.com/x']) {
    assert.equal((await legal('POST', `/kontrak/${k.id}/dokumen`, { kategori: 'draft', nama: 'x', lokasi })).status, 400, lokasi);
  }
  assert.equal((await legal('POST', `/kontrak/${k.id}/dokumen`, { kategori: 'rahasia', nama: 'x', lokasi: 'https://drive.example/x' })).status, 400);
  assert.equal((await legal('POST', `/kontrak/${k.id}/dokumen`, { kategori: 'draft', nama: 'sub', lokasi: 'https://a.docs.example/x' })).status, 201); // subdomain sah

  const detail = (await legal('GET', `/kontrak/${k.id}`)).data;
  assert.ok(detail.dokumen.length >= 2);
  assert.ok(detail.dokumen.every((d) => d.lokasi === undefined), 'lokasi asli tidak dikirim ke tampilan');

  const r = await legal.mentah('GET', `/dokumen/${v1.data.id}/buka`);
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), 'https://drive.example/draft');
  assert.equal((await u.db.satu("SELECT count(*)::int AS n FROM audit_log WHERE aksi = 'dokumen_dibuka' AND objek_id = $1", [v1.data.id])).n, 1);
  // Viewer tidak boleh membuka dan tidak melihat daftar dokumen.
  assert.equal((await viewer.mentah('GET', `/dokumen/${v1.data.id}/buka`)).status, 403);
  assert.deepEqual((await viewer('GET', `/kontrak/${k.id}`)).data.dokumen, []);
  // Diarsipkan = tidak bisa dibuka lagi.
  assert.equal((await legal('DELETE', `/dokumen/${v1.data.id}`)).status, 200);
  assert.equal((await legal.mentah('GET', `/dokumen/${v1.data.id}/buka`)).status, 404);
});

test('dokumen final terakhir pada kontrak aktif tidak boleh diarsipkan', async () => {
  const id = await kontrakAktif();
  const final = (await legal('GET', `/kontrak/${id}`)).data.dokumen.find((d) => d.kategori === 'final_ttd');
  const r = await legal('DELETE', `/dokumen/${final.id}`);
  assert.equal(r.status, 409);
  await legal('POST', `/kontrak/${id}/dokumen`, dok('final_ttd')); // versi 2
  assert.equal((await legal('DELETE', `/dokumen/${final.id}`)).status, 200);
});

// ---------- Persetujuan berjenjang ----------

test('routing persetujuan: kontrak bernilai wajib melalui Finance; langkah dilewati ditolak', async () => {
  const id = await sampaiReviewLegal({ nilai_kontrak: '5000000' });
  const lompat = await T(legal2, id, 'menunggu_ttd');
  assert.equal(lompat.status, 409);
  assert.match(lompat.data.pesan, /Review Finance/);
  assert.deepEqual((await legal2('GET', `/kontrak/${id}`)).data.transisi_tersedia, ['draft', 'review_finance']); // loncatan tidak ditawarkan
  assert.equal((await T(legal2, id, 'review_finance')).status, 200);
  assert.equal((await T(legal, id, 'menunggu_ttd')).status, 403); // bukan Finance
  assert.deepEqual((await finance('GET', `/kontrak/${id}`)).data.transisi_tersedia.sort(), ['menunggu_ttd', 'review_legal']);
  assert.equal((await T(finance, id, 'menunggu_ttd')).status, 200);
  const p = (await legal('GET', `/kontrak/${id}`)).data.persetujuan;
  assert.deepEqual(p.map((x) => [x.tahap, x.keputusan]).reverse(), [['legal', 'setuju'], ['finance', 'setuju']]);
});

test('risiko tinggi wajib Direksi; pengembalian butuh alasan dan tercatat', async () => {
  const id = await sampaiReviewLegal({ tingkat_risiko: 'tinggi' });
  assert.equal((await T(legal2, id, 'menunggu_ttd')).status, 409);
  assert.equal((await T(legal2, id, 'persetujuan_direksi')).status, 200);
  assert.equal((await T(direksi, id, 'review_legal')).status, 409); // tanpa alasan
  assert.equal((await T(direksi, id, 'review_legal', 'Klausul sanksi perlu direvisi')).status, 200);
  const p = (await legal('GET', `/kontrak/${id}`)).data.persetujuan;
  assert.equal(p[0].tahap, 'direksi'); assert.equal(p[0].keputusan, 'kembalikan');
});

test('ambang Direksi dibaca dari pengaturan, bukan hardcode', async () => {
  const buat = async () => {
    const id = await sampaiReviewLegal({ nilai_kontrak: '2000000', tingkat_risiko: 'rendah' });
    await T(legal2, id, 'review_finance');
    return id;
  };
  const a = await buat();
  assert.equal((await T(finance, a, 'persetujuan_direksi')).status, 409); // ambang 0 = nonaktif
  assert.equal((await legal('PATCH', '/pengaturan', { ambang_direksi: '1000000' })).status, 200);
  const b = await buat();
  assert.equal((await T(finance, b, 'menunggu_ttd')).status, 409);
  assert.equal((await T(finance, b, 'persetujuan_direksi')).status, 200);
  assert.equal((await T(direksi, b, 'menunggu_ttd')).status, 200);
  await legal('PATCH', '/pengaturan', { ambang_direksi: '0' });
});

// ---------- Nilai kontrak dan hak akses per peran ----------

test('kolom nilai tidak pernah dikirim ke peran tanpa hak (PIC, Viewer), dikirim ke Legal/Finance/Direksi', async () => {
  const { data: k } = await legal('POST', '/kontrak', baru({ judul: 'Berisi nilai', nilai_kontrak: '123456789.50', mata_uang: 'IDR', skema_pembayaran: 'Termin RAHASIA-XYZ' }));
  for (const [nama, kl, ada] of [['pic', pic, false], ['viewer', viewer, false], ['legal', legal, true], ['finance', finance, true], ['direksi', direksi, true]]) {
    const detail = await kl('GET', `/kontrak/${k.id}`);
    const daftar = await kl('GET', '/kontrak?q=Berisi');
    const teks = JSON.stringify(detail.data) + JSON.stringify(daftar.data);
    assert.equal(teks.includes('123456789'), ada, `${nama}: nilai ${ada ? 'harus' : 'tidak boleh'} ada`);
    assert.equal(teks.includes('RAHASIA-XYZ'), ada, `${nama}: skema pembayaran`);
    assert.equal('nilai_kontrak' in detail.data, ada, `${nama}: kunci nilai_kontrak`);
  }
  assert.equal((await legal('GET', `/kontrak/${k.id}`)).data.nilai_kontrak, '123456789.50'); // numeric tetap string, tanpa float
});

test('hanya Legal yang boleh menulis nilai; nilai divalidasi', async () => {
  assert.equal((await pic('POST', '/kontrak', baru({ nilai_kontrak: '1000' }))).status, 403);
  const { data: k } = await pic('POST', '/kontrak', baru({ judul: 'Milik PIC' }));
  assert.equal((await pic('PATCH', `/kontrak/${k.id}`, { nilai_kontrak: '1000' })).status, 403);
  assert.equal((await pic('PATCH', `/kontrak/${k.id}`, { mata_uang: 'USD' })).status, 403);
  assert.equal((await finance('PATCH', `/kontrak/${k.id}`, { nilai_kontrak: '1000' })).status, 403);
  for (const salah of ['abc', '-5', '1e9', '1,5', '1.234', '99999999999999999']) {
    assert.equal((await legal('PATCH', `/kontrak/${k.id}`, { nilai_kontrak: salah })).status, 400, salah);
  }
  assert.equal((await legal('PATCH', `/kontrak/${k.id}`, { nilai_kontrak: '12.5', mata_uang: 'usd' })).status, 200);
  const d = (await legal('GET', `/kontrak/${k.id}`)).data;
  assert.equal(d.nilai_kontrak, '12.50'); assert.equal(d.mata_uang, 'USD');
  assert.equal((await legal('PATCH', `/kontrak/${k.id}`, { nilai_kontrak: null })).status, 200);
});

test('dashboard: nilai aktif dikelompokkan per mata uang dan hanya untuk peran berhak', async () => {
  const a = await kontrakAktif(); const b = await kontrakAktif();
  await u.db.jalankan("UPDATE kontrak SET nilai_kontrak = 1000.10, mata_uang = 'IDR', jenis_kontrak = 'pendapatan' WHERE id = $1", [a]);
  await u.db.jalankan("UPDATE kontrak SET nilai_kontrak = 500.25, mata_uang = 'USD', jenis_kontrak = 'pendapatan' WHERE id = $1", [b]);
  const f = (await finance('GET', '/dashboard')).data.nilai_aktif;
  assert.ok(f.some((x) => x.mata_uang === 'USD' && x.total === '500.25'));
  assert.ok(f.every((x) => x.mata_uang === 'IDR' || x.mata_uang === 'USD'));
  assert.equal((await pic('GET', '/dashboard')).data.nilai_aktif, undefined);
  assert.equal((await viewer('GET', '/dashboard')).data.nilai_aktif, undefined);
});

test('antrian "menunggu Anda" untuk penyetuju tidak menghitung kontrak buatannya sendiri', async () => {
  const antrian = async (k) => (await k('GET', '/dashboard')).data.kartu.menunggu_anda;
  const [a0, b0] = [await antrian(legal), await antrian(legal2)];
  await sampaiReviewLegal({ judul: 'Antrian uji' }); // dibuat legal: legal tidak boleh menyetujuinya sendiri
  assert.equal(await antrian(legal), a0);
  assert.equal(await antrian(legal2), b0 + 1);
});

test('Admin Sistem tidak menjangkau data kontrak dalam bentuk apa pun', async () => {
  const id = await kontrakAktif();
  const fin = (await legal('GET', `/kontrak/${id}`)).data.dokumen[0];
  for (const [m, p, b] of [['GET', '/kontrak'], ['GET', '/dashboard'], ['GET', `/kontrak/${id}`], ['POST', '/kontrak', baru()],
    ['PATCH', `/kontrak/${id}`, { judul: 'x' }], ['POST', `/kontrak/${id}/transisi`, { ke: 'diputus', catatan: 'x' }],
    ['POST', `/kontrak/${id}/perpanjangan`, { tanggal_berakhir_baru: tambahHari(H, 900) }], ['POST', `/kontrak/${id}/dokumen`, dok('draft')],
    ['GET', `/dokumen/${fin.id}/buka`], ['DELETE', `/dokumen/${fin.id}`], ['GET', '/laporan/ekspor'], ['GET', '/pengaturan'], ['GET', '/aturan-reminder']]) {
    assert.equal((await sistem(m, p, b)).status, 403, `${m} ${p}`);
  }
  assert.deepEqual((await sistem('GET', '/master')).data.counterparty, []);
});

test('Viewer dan Finance membaca saja; Direksi hanya bertindak di tahapnya', async () => {
  const id = await kontrakAktif();
  const d = (await viewer('GET', `/kontrak/${id}`)).data;
  assert.equal(d.bisa_ubah, false); assert.equal(d.bisa_unggah, false);
  assert.deepEqual(d.transisi_tersedia, []);
  for (const k of [viewer, finance]) {
    assert.equal((await k('POST', '/kontrak', baru())).status, 403);
    assert.equal((await k('PATCH', `/kontrak/${id}`, { judul: 'x' })).status, 403);
    assert.equal((await k('POST', `/kontrak/${id}/perpanjangan`, { tanggal_berakhir_baru: tambahHari(H, 900) })).status, 403);
    assert.equal((await k('POST', `/kontrak/${id}/dokumen`, dok('draft'))).status, 403);
  }
  assert.equal((await T(legal, id, 'diputus', 'x')).status, 403); // tabel status mengizinkan, perannya tidak
  assert.equal((await T(finance, id, 'diputus', 'x')).status, 403);
  assert.deepEqual((await direksi('GET', `/kontrak/${id}`)).data.transisi_tersedia, ['diputus']);
  assert.equal((await T(direksi, id, 'diputus', 'alasan uji')).status, 200);
});

test('Finance hanya membuka dokumen final/adendum pada kontrak bernilai', async () => {
  const id = await kontrakAktif();
  const dokumen = (await legal('GET', `/kontrak/${id}`)).data.dokumen;
  const final = dokumen.find((d) => d.kategori === 'final_ttd'); const draf = dokumen.find((d) => d.kategori === 'draft');
  assert.equal((await finance.mentah('GET', `/dokumen/${final.id}/buka`)).status, 404); // belum bernilai
  await u.db.jalankan('UPDATE kontrak SET nilai_kontrak = 1000 WHERE id = $1', [id]);
  assert.equal((await finance.mentah('GET', `/dokumen/${final.id}/buka`)).status, 302);
  assert.equal((await finance.mentah('GET', `/dokumen/${draf.id}/buka`)).status, 404); // draft bukan haknya
  assert.deepEqual((await finance('GET', `/kontrak/${id}`)).data.dokumen.map((d) => d.kategori).sort(), ['final_ttd']);
});

test('PIC hanya melihat dan mengubah kontrak divisinya (uji IDOR), termasuk dokumen', async () => {
  const { data: akd } = await legal('POST', '/kontrak', baru({ judul: 'Milik AKD' }));
  const { data: bd } = await legal('POST', '/kontrak', baruBody(BD, { judul: 'Milik BD' }));
  const dBD = await legal('POST', `/kontrak/${bd.id}/dokumen`, dok('draft'));
  const daftar = (await pic('GET', '/kontrak')).data.data;
  assert.ok(daftar.length > 0 && daftar.every((k) => k.divisi_id === AKD));
  assert.ok(!daftar.some((k) => k.id === bd.id));
  assert.equal((await pic('GET', `/kontrak/${bd.id}`)).status, 404);
  assert.equal((await pic('PATCH', `/kontrak/${bd.id}`, { judul: 'dibajak' })).status, 404);
  assert.equal((await T(pic, bd.id, 'dibatalkan', 'x')).status, 404);
  assert.equal((await pic('POST', `/kontrak/${bd.id}/dokumen`, dok('draft'))).status, 404);
  assert.equal((await pic.mentah('GET', `/dokumen/${dBD.data.id}/buka`)).status, 404);
  assert.equal((await picBD('GET', `/kontrak/${akd.id}`)).status, 404);
  const dash = (await picBD('GET', '/dashboard')).data;
  assert.equal(dash.kartu.total, (await picBD('GET', '/kontrak')).data.total);
});

test('PIC: kontrak baru selalu di divisinya, tidak bisa pindah divisi, terkunci setelah Menunggu TTD', async () => {
  const dibuat = await pic('POST', '/kontrak', baruBody(BD)); // divisi di body diabaikan
  assert.equal(dibuat.status, 201);
  assert.equal(dibuat.data.divisi_id, AKD);
  const id = dibuat.data.id;
  const pindah = await pic('PATCH', `/kontrak/${id}`, { divisi_id: BD, judul: 'Judul baru', ruang_lingkup: 'Isi' });
  assert.equal(pindah.status, 200); assert.equal(pindah.data.divisi_id, AKD);
  await pic('POST', `/kontrak/${id}/dokumen`, dok('draft'));
  assert.equal((await T(pic, id, 'review_legal')).status, 200);
  assert.equal((await T(pic, id, 'menunggu_ttd')).status, 403); // PIC bukan penyetuju
  assert.equal((await T(legal, id, 'menunggu_ttd')).status, 200);
  assert.equal((await pic('PATCH', `/kontrak/${id}`, { judul: 'telat' })).status, 403);
  assert.equal((await pic('GET', `/kontrak/${id}`)).data.bisa_ubah, false);
});

test('penyetuju tidak boleh sama dengan pembuat kontrak; penyetuju lain mendapat notifikasi', async () => {
  const id = await sampaiReviewLegal({ judul: 'Uji empat mata' });
  const sendiri = await T(legal, id, 'menunggu_ttd');
  assert.equal(sendiri.status, 403);
  assert.match(sendiri.data.pesan, /pembuat/);
  assert.ok(!(await legal('GET', `/kontrak/${id}`)).data.transisi_tersedia.includes('menunggu_ttd'));
  const notif = (await legal2('GET', '/notifikasi')).data;
  assert.ok(notif.data.some((n) => n.kontrak_id === id && /menunggu persetujuan Anda/.test(n.pesan)));
  assert.ok(!(await legal('GET', '/notifikasi')).data.data.some((n) => n.kontrak_id === id), 'pelaku tidak diberi tahu tentang aksinya sendiri');
  assert.equal((await T(legal2, id, 'menunggu_ttd')).status, 200);
});

test('pembatalan butuh alasan dan transisi bersamaan tidak ganda', async () => {
  const { data: k } = await legal('POST', '/kontrak', baru());
  assert.equal((await T(legal, k.id, 'dibatalkan')).status, 409);
  const [a, b] = await Promise.all([T(legal, k.id, 'dibatalkan', 'alasan'), T(legal2, k.id, 'dibatalkan', 'alasan')]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal((await u.db.satu("SELECT count(*)::int AS n FROM riwayat_status WHERE kontrak_id = $1 AND status_baru = 'dibatalkan'", [k.id])).n, 1);
});

test('riwayat_status, persetujuan, dan audit_log tidak bisa diubah atau dihapus', async () => {
  for (const sql of ['DELETE FROM audit_log', "UPDATE riwayat_status SET catatan = 'x'", 'DELETE FROM persetujuan', "UPDATE persetujuan SET catatan = 'x'"]) {
    await assert.rejects(() => u.db.jalankan(sql), /hanya boleh ditambah/, sql);
  }
});

test('dashboard kontrak: kartu, radar, bulan', async () => {
  const { status, data } = await legal('GET', '/dashboard');
  assert.equal(status, 200);
  assert.equal(data.berakhir_per_bulan.length, 12);
  assert.ok(data.kartu.total >= 1);
  assert.equal(data.radar.length, 6);
});
