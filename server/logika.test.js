import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitung, cekTransisi, harusBerakhir, hariIni, tambahHari, TRANSISI, STATUS } from './logika.js';

const H = '2026-11-23';
const k = (sisa, extra = {}) => ({ status: 'aktif', tanggal_berakhir: tambahHari(H, sisa), masa_pemberitahuan_hari: 0, perpanjangan_otomatis: 0, ...extra });

test('tingkat perhatian pada nilai batas 181/180, 91/90, 1/0, -1', () => {
  const t = (s) => hitung(k(s), H).tingkat;
  assert.deepEqual([181, 180, 91, 90, 1, 0, -1].map(t), ['hijau', 'kuning', 'kuning', 'oranye', 'oranye', 'merah', 'merah']);
});

test('tanpa tingkat bila status bukan aktif/negosiasi', () => {
  assert.equal(hitung(k(10, { status: 'draft' }), H).tingkat, null);
});

test('batas notice dan notice terlewat', () => {
  const a = hitung(k(20, { masa_pemberitahuan_hari: 30 }), H);
  assert.equal(a.tanggal_batas_notice, tambahHari(H, -10));
  assert.equal(a.notice_terlewat, true);
  assert.equal(hitung(k(40, { masa_pemberitahuan_hari: 30 }), H).notice_terlewat, false);
  assert.equal(hitung(k(5, { masa_pemberitahuan_hari: 0 }), H).notice_terlewat, false);
});

test('mendekati berakhir: 1..90 hari saja', () => {
  assert.deepEqual([91, 90, 1, 0].map((s) => hitung(k(s), H).mendekati_berakhir), [false, true, true, false]);
});

test('auto-renew tidak menjadi berakhir, minta konfirmasi', () => {
  const a = k(0, { perpanjangan_otomatis: 1 });
  assert.equal(harusBerakhir(a, H), false);
  assert.equal(hitung(a, H).perlu_konfirmasi_auto_renew, true);
  assert.equal(harusBerakhir(k(0), H), true);
  assert.equal(harusBerakhir(k(1), H), false);
});

test('tabel transisi: semua pasangan di luar tabel ditolak', () => {
  for (const dari of STATUS) {
    for (const ke of STATUS) {
      const sah = TRANSISI[dari].includes(ke);
      const lengkap = { status: dari, judul: 'x', jenis_dokumen: 'MoU', counterparty_id: 1, divisi_id: 1, ruang_lingkup: 'x',
        tautan_dokumen_final: 'https://a.example', nomor_kontrak: 'N', tanggal_ttd: H, tanggal_mulai: H, tanggal_berakhir: H };
      const hasil = cekTransisi(lengkap, ke, 'alasan');
      assert.equal(hasil === null, sah, `${dari} -> ${ke}`);
    }
  }
});

test('aktif butuh dokumen final dan tanggal lengkap', () => {
  assert.match(cekTransisi({ status: 'menunggu_ttd' }, 'aktif', ''), /dokumen final/);
});

test('alasan wajib untuk pemutusan dan pembatalan', () => {
  assert.match(cekTransisi({ status: 'aktif' }, 'diputus', '  '), /Alasan/);
});

test('radar: kelompok sisa hari pada nilai batas', () => {
  const r = (s) => hitung(k(s), H).rentang;
  assert.deepEqual([-1, 0, 1, 30, 31, 60, 61, 90, 91, 180, 181].map(r),
    ['lewat', 'lewat', '30', '30', '60', '60', '90', '90', '180', '180', 'aman']);
  assert.equal(hitung(k(5, { status: 'draft' }), H).rentang, null);
});

test('progres masa: 0..1 dan dibatasi', () => {
  const p = (mulaiOffset, sisa) => hitung(k(sisa, { tanggal_mulai: tambahHari(H, mulaiOffset) }), H).progres_masa;
  assert.equal(p(-50, 50), 0.5);
  assert.equal(p(-10, -5), 1);
  assert.equal(p(5, 50) , 0);
  assert.equal(hitung(k(5), H).progres_masa, null);
});

test('hariIni memakai zona Asia/Jakarta', () => {
  // 17:30 UTC 22 Nov = 00:30 WIB 23 Nov
  assert.equal(hariIni(new Date('2026-11-22T17:30:00Z')), '2026-11-23');
  assert.equal(hariIni(new Date('2026-11-22T16:59:00Z')), '2026-11-22');
});
