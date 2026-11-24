import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitung, cekTransisi, harusBerakhir, hariIni, tambahHari, TRANSISI, STATUS, AMBANG_BAWAAN, tujuanSetelahLegal, tujuanSetelahFinance, transisiTersedia, tanggalPicu } from './logika.js';

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

test('tabel transisi: pasangan di luar tabel selalu ditolak, yang ada di tabel tidak pernah dinyatakan tidak diizinkan', () => {
  const lengkap = { judul: 'x', jenis_dokumen: 'MoU', counterparty_id: 1, divisi_id: 1, ruang_lingkup: 'x', punya_draft: true, punya_final: true,
    nomor_kontrak: 'N', tanggal_ttd: H, tanggal_mulai: H, tanggal_berakhir: H, tingkat_risiko: 'sedang', nilai_kontrak: null };
  for (const dari of STATUS) {
    for (const ke of STATUS) {
      const hasil = cekTransisi({ ...lengkap, status: dari }, ke, 'alasan');
      if (TRANSISI[dari].includes(ke)) assert.doesNotMatch(String(hasil), /tidak diizinkan/, dari + " -> " + ke);
      else assert.match(String(hasil), /tidak diizinkan/, dari + " -> " + ke);
    }
  }
});

test('aktif butuh dokumen final dan data lengkap; ajukan ke Legal butuh draft', () => {
  const dasar = { status: 'menunggu_ttd', nomor_kontrak: 'N', tanggal_ttd: H, tanggal_mulai: H, tanggal_berakhir: tambahHari(H, 9) };
  assert.match(cekTransisi({ ...dasar, punya_final: false }, 'aktif', ''), /final/);
  assert.match(cekTransisi({ ...dasar, punya_final: true, nomor_kontrak: null }, 'aktif', ''), /nomor_kontrak/);
  assert.equal(cekTransisi({ ...dasar, punya_final: true }, 'aktif', ''), null);
  const draf = { status: 'draft', judul: 'x', jenis_dokumen: 'MoU', counterparty_id: 1, divisi_id: 1, ruang_lingkup: 'x' };
  assert.match(cekTransisi({ ...draf, punya_draft: false }, 'review_legal', ''), /draft/);
  assert.equal(cekTransisi({ ...draf, punya_draft: true }, 'review_legal', ''), null);
});

test('routing persetujuan: nilai > 0 -> Finance; risiko tinggi atau nilai >= ambang -> Direksi; ambang 0 = nonaktif', () => {
  const k = (e) => ({ status: 'review_legal', tingkat_risiko: 'sedang', nilai_kontrak: null, ...e });
  assert.equal(tujuanSetelahLegal(k(), AMBANG_BAWAAN), 'menunggu_ttd');
  assert.equal(tujuanSetelahLegal(k({ nilai_kontrak: '1.00' }), AMBANG_BAWAAN), 'review_finance');
  assert.equal(tujuanSetelahLegal(k({ nilai_kontrak: '0.00' }), AMBANG_BAWAAN), 'menunggu_ttd');
  assert.equal(tujuanSetelahLegal(k({ tingkat_risiko: 'tinggi' }), AMBANG_BAWAAN), 'persetujuan_direksi');
  const amb = { ...AMBANG_BAWAAN, direksi: 1000 };
  assert.equal(tujuanSetelahFinance(k({ nilai_kontrak: '999.99' }), amb), 'menunggu_ttd'); // batas bawah
  assert.equal(tujuanSetelahFinance(k({ nilai_kontrak: '1000.00' }), amb), 'persetujuan_direksi'); // batas tepat
  assert.equal(tujuanSetelahFinance(k({ nilai_kontrak: '99999999' }), AMBANG_BAWAAN), 'menunggu_ttd');
  assert.match(cekTransisi(k({ nilai_kontrak: '5' }), 'menunggu_ttd', 'x'), /Review Finance/);
  assert.equal(cekTransisi(k({ nilai_kontrak: '5' }), 'review_finance', 'x'), null);
  assert.deepEqual(transisiTersedia(k({ nilai_kontrak: '5' })), ['draft', 'review_finance']);
  assert.deepEqual(transisiTersedia(k()), ['draft', 'menunggu_ttd']);
});

test('pemicu reminder dari tanggal berakhir dan batas notice', () => {
  const kt = { tanggal_berakhir: '2027-03-31', masa_pemberitahuan_hari: 30 };
  assert.equal(tanggalPicu(kt, { acuan: 'berakhir', hari_sebelum: 30 }), '2027-03-01');
  assert.equal(tanggalPicu(kt, { acuan: 'notice', hari_sebelum: 7 }), '2027-02-22'); // notice = 1 Mar, dikurangi 7
  assert.equal(tanggalPicu({ ...kt, masa_pemberitahuan_hari: 0 }, { acuan: 'notice', hari_sebelum: 7 }), null); // tanpa notice
  assert.equal(tanggalPicu({ ...kt, tanggal_berakhir: null }, { acuan: 'berakhir', hari_sebelum: 7 }), null);
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
