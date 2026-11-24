// Mesin reminder, notifikasi dalam aplikasi, email digest, job berakhir, cron. PostgreSQL asli.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mulai, H, tambahHari, baruBody, lengkap, dok } from './uji-bantu.js';
import { jalankanReminder, jalankanJobBerakhir } from './jobs.js';

let u; let AKD; let BD;
let picAKD; let picBD; let legal; let direksi; let viewer;
const surat = [];
const kirimOk = async (m) => { surat.push(m); };

before(async () => {
  u = await mulai();
  AKD = await u.divisiId('AKD'); BD = await u.divisiId('BD');
  await u.buatPengguna('pic@uji.test', 'pic', 'AKD'); await u.buatPengguna('picbd@uji.test', 'pic', 'BD');
  await u.buatPengguna('legal@uji.test', 'legal'); await u.buatPengguna('legal2@uji.test', 'legal');
  await u.buatPengguna('dir@uji.test', 'direksi'); await u.buatPengguna('viewer@uji.test', 'viewer');
  [picAKD, picBD, legal, direksi, viewer] = await Promise.all(['pic', 'picbd', 'legal', 'dir', 'viewer'].map((n) => u.masuk(`${n}@uji.test`)));
});
after(() => u.selesai());

let cpId;
const kontrakSql = async (judul, sisa, { divisi = AKD, notice = 0, otomatis = false, nilai = null, status = 'aktif' } = {}) => {
  cpId ??= (await u.db.satu("INSERT INTO counterparty (nama, nama_normal) VALUES ('Mitra','mitra') RETURNING id")).id;
  return (await u.db.satu(`INSERT INTO kontrak (nomor_kontrak, judul, jenis_dokumen, counterparty_id, divisi_id, pic_nama, tanggal_mulai, tanggal_berakhir,
    perpanjangan_otomatis, masa_pemberitahuan_hari, status, nilai_kontrak) VALUES ($1,$2,'MoU',$3,$4,'P',$5,$6,$7,$8,$9,$10) RETURNING id`,
  [`R/${judul}`, judul, cpId, divisi, tambahHari(H, sisa - 400), tambahHari(H, sisa), otomatis, notice, status, nilai])).id;
};

// Setiap tes mulai bersih: riwayat pengiriman dihapus dan kontrak tes sebelumnya diarsipkan (tidak ikut diingatkan).
const bersihkan = async () => {
  await u.db.jalankan('TRUNCATE pengiriman_notifikasi, notifikasi_app RESTART IDENTITY');
  await u.db.jalankan('UPDATE kontrak SET diarsipkan_pada = now() WHERE diarsipkan_pada IS NULL');
};
const hitungNotif = async (email) => (await u.db.satu('SELECT count(*)::int AS n FROM notifikasi_app n JOIN pengguna p ON p.id = n.penerima_id WHERE p.email = $1', [email])).n;

test('reminder bertingkat: penerima sesuai aturan; catch-up hanya sekali; idempoten', async () => {
  await bersihkan();
  const id = await kontrakSql('Kontrak dekat berakhir', 25); // aturan 120, 60, 30 sudah jatuh tempo, 7 belum
  const r1 = await jalankanReminder(u.db);
  assert.equal(r1.notifikasi_baru, 4); // PIC divisi + 2 Legal + Direksi
  assert.equal(await hitungNotif('pic@uji.test'), 1); // 3 aturan jatuh tempo, tetapi hanya 1 notifikasi (catch-up sekali)
  assert.equal(await hitungNotif('legal@uji.test'), 1);
  assert.equal(await hitungNotif('legal2@uji.test'), 1);
  assert.equal(await hitungNotif('dir@uji.test'), 1);
  assert.equal(await hitungNotif('picbd@uji.test'), 0, 'PIC divisi lain tidak diberi tahu');
  assert.equal(await hitungNotif('viewer@uji.test'), 0);
  const rows = await u.db.q("SELECT p.email, n.status FROM pengiriman_notifikasi n JOIN pengguna p ON p.id = n.penerima_id WHERE n.kontrak_id = $1 AND n.kanal = 'app' AND p.email = 'pic@uji.test'", [id]);
  assert.deepEqual(rows.map((x) => x.status).sort(), ['dilewati', 'dilewati', 'terkirim']);
  const r2 = await jalankanReminder(u.db); // jalan dua kali pada hari yang sama
  assert.equal(r2.notifikasi_baru, 0);
  assert.equal(await hitungNotif('pic@uji.test'), 1);
});

test('notifikasi: hanya milik sendiri, tanpa nilai kontrak, bisa ditandai dibaca', async () => {
  await bersihkan();
  await kontrakSql('Kontrak bernilai', 20, { nilai: '987654321' });
  await jalankanReminder(u.db);
  const n = (await picAKD('GET', '/notifikasi')).data;
  assert.equal(n.belum_dibaca, 1);
  assert.match(n.data[0].pesan, /Kontrak bernilai/);
  assert.ok(!JSON.stringify(n).includes('987654321'), 'notifikasi tidak boleh memuat nilai');
  assert.equal((await picBD('GET', '/notifikasi')).data.data.length, 0);
  assert.equal((await picBD('POST', `/notifikasi/${n.data[0].id}/baca`)).status, 404); // milik orang lain dianggap tidak ada
  assert.equal((await picAKD('POST', `/notifikasi/${n.data[0].id}/baca`)).status, 200);
  assert.equal((await picAKD('GET', '/notifikasi')).data.belum_dibaca, 0);
  assert.equal((await legal('GET', '/notifikasi')).data.belum_dibaca, 1);
  assert.equal((await legal('POST', '/notifikasi/baca-semua')).status, 200);
  assert.equal((await legal('GET', '/notifikasi')).data.belum_dibaca, 0);
  assert.equal((await viewer('GET', '/notifikasi')).data.data.length, 0);
});

test('notice: reminder dari batas pemberitahuan; tanpa notice tidak ada reminder notice', async () => {
  await bersihkan();
  await u.db.jalankan("DELETE FROM aturan_reminder WHERE acuan = 'berakhir'"); // isolasi: hanya aturan notice
  // berakhir H+40, notice 30 hari -> batas notice H+10; aturan notice H-7 => picu H+3, H-30 => picu H-20 (sudah lewat)
  await kontrakSql('Kontrak dengan notice', 40, { notice: 30 });
  await kontrakSql('Kontrak tanpa notice', 40, { notice: 0 });
  const r = await jalankanReminder(u.db);
  assert.ok(r.notifikasi_baru >= 1);
  const pesan = (await u.db.q("SELECT pesan FROM notifikasi_app WHERE jenis = 'reminder_notice'")).map((x) => x.pesan);
  assert.ok(pesan.length > 0 && pesan.every((p) => p.includes('Kontrak dengan notice')), 'hanya kontrak yang punya masa notice');
  await u.db.jalankan("INSERT INTO aturan_reminder (acuan, hari_sebelum, peran_penerima) VALUES ('berakhir',120,'pic'),('berakhir',60,'pic'),('berakhir',60,'legal'),('berakhir',30,'pic'),('berakhir',30,'legal'),('berakhir',30,'direksi'),('berakhir',7,'pic'),('berakhir',7,'legal'),('berakhir',7,'direksi')");
});

test('aturan nonaktif tidak dipakai', async () => {
  await bersihkan();
  await u.db.jalankan('UPDATE aturan_reminder SET aktif = false');
  await kontrakSql('Aturan mati', 5);
  assert.equal((await jalankanReminder(u.db)).notifikasi_baru, 0);
  await u.db.jalankan('UPDATE aturan_reminder SET aktif = true');
});

test('perpanjangan mereset siklus: reminder dihitung ulang', async () => {
  await bersihkan();
  const id = await kontrakSql('Kontrak diperpanjang', 20);
  await jalankanReminder(u.db);
  const sebelum = await hitungNotif('pic@uji.test');
  assert.ok(sebelum >= 1);
  assert.equal((await jalankanReminder(u.db)).notifikasi_baru, 0);
  const p = await legal('POST', `/kontrak/${id}/perpanjangan`, { tanggal_berakhir_baru: tambahHari(H, 500) });
  assert.equal(p.status, 200); assert.equal(p.data.siklus_perpanjangan, 1);
  assert.equal((await jalankanReminder(u.db)).notifikasi_baru, 0); // masih jauh
  await u.db.jalankan('UPDATE kontrak SET tanggal_berakhir = $1 WHERE id = $2', [tambahHari(H, 20), id]); // siklus tetap 1
  assert.ok((await jalankanReminder(u.db)).notifikasi_baru >= 3, 'siklus baru = pengiriman baru');
});

test('hanya kontrak aktif/negosiasi, tidak diarsipkan, yang diingatkan', async () => {
  await bersihkan();
  await kontrakSql('Masih draft', 3, { status: 'draft' });
  await kontrakSql('Sudah berakhir', 3, { status: 'berakhir' });
  const a = await kontrakSql('Diarsipkan', 3);
  await u.db.jalankan('UPDATE kontrak SET diarsipkan_pada = now() WHERE id = $1', [a]);
  assert.equal((await jalankanReminder(u.db)).notifikasi_baru, 0);
});

test('email: satu digest per penerima, tanpa nilai; gagal diulang maks 3 kali', async () => {
  await bersihkan(); surat.length = 0;
  await kontrakSql('Digest satu', 20, { nilai: '555000111' });
  await kontrakSql('Digest dua', 15, { nilai: '555000111' });
  const r = await jalankanReminder(u.db, { kirimEmail: kirimOk, urlApp: 'https://app.contoh.id' });
  assert.equal(r.email_gagal, 0);
  const keAKD = surat.filter((m) => m.to === 'pic@uji.test');
  assert.equal(keAKD.length, 1, 'dua kontrak, satu email');
  assert.match(keAKD[0].subject, /^\[Partnership TEN\] Ringkasan kontrak: 2 perlu perhatian$/);
  assert.match(keAKD[0].text, /Digest satu/); assert.match(keAKD[0].text, /Digest dua/);
  assert.ok(!JSON.stringify(surat).includes('555000111'), 'email tidak boleh memuat nilai');
  assert.match(keAKD[0].text, /hanya dapat dibuka setelah login/);
  assert.equal(surat.filter((m) => m.to === 'picbd@uji.test').length, 0);
  surat.length = 0;
  assert.equal((await jalankanReminder(u.db, { kirimEmail: kirimOk })).email_terkirim, 0, 'idempoten: tidak kirim ulang');
  assert.equal(surat.length, 0);

  // Pengiriman gagal: dicoba ulang pada run berikutnya sampai 3 percobaan, lalu berhenti.
  await bersihkan();
  await kontrakSql('Digest gagal', 10);
  const gagal = async () => { throw new Error('SMTP mati'); };
  const g1 = await jalankanReminder(u.db, { kirimEmail: gagal });
  assert.ok(g1.email_gagal >= 1);
  const percobaan = async () => Number((await u.db.satu("SELECT max(percobaan)::int AS m FROM pengiriman_notifikasi WHERE kanal = 'email' AND status = 'gagal'")).m);
  assert.equal(await percobaan(), 1);
  await jalankanReminder(u.db, { kirimEmail: gagal }); assert.equal(await percobaan(), 2);
  await jalankanReminder(u.db, { kirimEmail: gagal }); assert.equal(await percobaan(), 3);
  let dipanggil = 0;
  await jalankanReminder(u.db, { kirimEmail: async () => { dipanggil++; } });
  assert.equal(dipanggil, 0, 'setelah 3 percobaan tidak diulang lagi');

  // Pulih di percobaan ke-2.
  await bersihkan();
  await kontrakSql('Digest pulih', 10);
  await jalankanReminder(u.db, { kirimEmail: gagal });
  surat.length = 0;
  const ok = await jalankanReminder(u.db, { kirimEmail: kirimOk });
  assert.ok(ok.email_terkirim >= 1 && surat.some((m) => /Digest pulih/.test(m.text)));
  assert.equal((await u.db.satu("SELECT count(*)::int AS n FROM pengiriman_notifikasi WHERE kanal = 'email' AND status = 'gagal'")).n, 0);
});

test('job berakhir: otomatis berakhir, auto-renew tidak; idempoten dan tercatat', async () => {
  const a = await kontrakSql('Habis biasa', -1);
  const b = await kontrakSql('Habis auto-renew', -1, { otomatis: true });
  assert.ok((await jalankanJobBerakhir(u.db)) >= 1);
  assert.equal(await jalankanJobBerakhir(u.db), 0);
  assert.equal((await u.db.satu('SELECT status FROM kontrak WHERE id = $1', [a])).status, 'berakhir');
  assert.equal((await u.db.satu('SELECT status FROM kontrak WHERE id = $1', [b])).status, 'aktif');
  assert.equal((await u.db.satu("SELECT pelaku_id FROM riwayat_status WHERE kontrak_id = $1 AND status_baru = 'berakhir'", [a])).pelaku_id, null); // pelaku = sistem
  assert.ok((await u.db.satu("SELECT nilai FROM pengaturan WHERE kunci = 'job_terakhir'")).nilai);
  const d = (await legal('GET', `/kontrak/${b}`)).data;
  assert.equal(d.perlu_konfirmasi_auto_renew, true);
});

test('cron: ditolak tanpa rahasia yang benar; nonaktif bila CRON_SECRET kosong', async () => {
  delete process.env.CRON_SECRET;
  const panggil = (job, auth) => fetch(`${u.origin}/api/cron/${job}`, { headers: auth ? { authorization: auth } : {} });
  assert.equal((await panggil('semua')).status, 503);
  process.env.CRON_SECRET = 'rahasia-cron-uji-123';
  try {
    assert.equal((await panggil('semua')).status, 401);
    assert.equal((await panggil('semua', 'Bearer salah')).status, 401);
    assert.equal((await panggil('semua', 'rahasia-cron-uji-123')).status, 401); // harus berformat Bearer
    assert.equal((await panggil('tidak-ada', 'Bearer rahasia-cron-uji-123')).status, 404);
    const r = await panggil('semua', 'Bearer rahasia-cron-uji-123');
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.ok('berakhir' in j && 'reminder' in j);
    assert.deepEqual(Object.keys(await (await panggil('reminder', 'Bearer rahasia-cron-uji-123')).json()), ['reminder']);
  } finally { delete process.env.CRON_SECRET; }
});
