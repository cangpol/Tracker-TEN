// Satu-satunya tempat logika masa berlaku dan transisi status (BREAKDOWN bagian 4 dan 6).

export const STATUS = [
  'draft', 'review_legal', 'review_finance', 'persetujuan_direksi', 'menunggu_ttd',
  'aktif', 'negosiasi_perpanjangan', 'berakhir', 'diputus', 'dibatalkan', 'arsip',
];

const PANTAU = ['aktif', 'negosiasi_perpanjangan'];

// 'berakhir' hanya oleh job sistem; negosiasi -> aktif hanya lewat perpanjangan.
export const TRANSISI = {
  draft: ['review_legal', 'dibatalkan'],
  review_legal: ['draft', 'review_finance', 'persetujuan_direksi', 'menunggu_ttd'],
  review_finance: ['review_legal', 'persetujuan_direksi', 'menunggu_ttd'],
  persetujuan_direksi: ['menunggu_ttd', 'review_legal'],
  menunggu_ttd: ['aktif'],
  aktif: ['negosiasi_perpanjangan', 'diputus'],
  negosiasi_perpanjangan: [],
  berakhir: ['arsip'],
  diputus: ['arsip'],
  dibatalkan: ['arsip'],
  arsip: [],
};

const WAJIB_ALASAN = new Set(['draft', 'dibatalkan', 'diputus', 'review_legal']);

export const AMBANG_BAWAAN = { kuning: 180, oranye: 90 };

/** Tanggal hari ini menurut Asia/Jakarta, format YYYY-MM-DD. */
export function hariIni(sekarang = new Date()) {
  return sekarang.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

const ms = (t) => Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10));

/** Selisih hari kalender a - b. */
export const selisihHari = (a, b) => Math.round((ms(a) - ms(b)) / 86400000);

export function tambahHari(tanggal, n) {
  return new Date(ms(tanggal) + n * 86400000).toISOString().slice(0, 10);
}

// shortcut: batas 30 dan 60 hari untuk tampilan "radar" tetap di kode; 90/180 dari pengaturan. Pindah ke pengaturan bila perlu diubah.
/** Kelompok sisa hari untuk radar masa berlaku. */
export function rentang(amb = AMBANG_BAWAAN) {
  const batas = [0, 30, 60, amb.oranye, amb.kuning];
  const label = ['Sudah lewat', `1–30 hari`, `31–60 hari`, `61–${amb.oranye} hari`, `${amb.oranye + 1}–${amb.kuning} hari`, `> ${amb.kuning} hari`];
  const tingkat = ['merah', 'oranye', 'oranye', 'oranye', 'kuning', 'hijau'];
  return label.map((l, i) => ({
    id: ['lewat', '30', '60', '90', '180', 'aman'][i], label: l, tingkat: tingkat[i],
    min: i === 0 ? -Infinity : batas[i - 1] + 1, max: i < batas.length ? batas[i] : Infinity,
  }));
}
export const rentangDari = (sisa, amb) => rentang(amb).find((r) => sisa >= r.min && sisa <= r.max).id;

/** Bidang turunan: tidak disimpan di database. */
export function hitung(k, hari, amb = AMBANG_BAWAAN) {
  const kosong = {
    progres_masa: null, rentang: null,
    sisa_hari: null, tanggal_batas_notice: null, tingkat: null,
    mendekati_berakhir: false, notice_terlewat: false, perlu_konfirmasi_auto_renew: false,
  };
  if (!k.tanggal_berakhir) return kosong;
  const sisa = selisihHari(k.tanggal_berakhir, hari);
  const batasNotice = tambahHari(k.tanggal_berakhir, -k.masa_pemberitahuan_hari);
  const dipantau = PANTAU.includes(k.status);
  let tingkat = null;
  if (dipantau) {
    tingkat = sisa <= 0 ? 'merah' : sisa <= amb.oranye ? 'oranye' : sisa <= amb.kuning ? 'kuning' : 'hijau';
  }
  const total = k.tanggal_mulai ? selisihHari(k.tanggal_berakhir, k.tanggal_mulai) : 0;
  return {
    // Porsi masa kontrak yang sudah berjalan (0..1), untuk bar progres di detail.
    progres_masa: total > 0 ? Math.min(1, Math.max(0, selisihHari(hari, k.tanggal_mulai) / total)) : null,
    rentang: dipantau ? rentangDari(sisa, amb) : null,
    sisa_hari: sisa,
    tanggal_batas_notice: batasNotice,
    tingkat,
    mendekati_berakhir: dipantau && sisa > 0 && sisa <= amb.oranye,
    notice_terlewat: dipantau && k.masa_pemberitahuan_hari > 0 && selisihHari(batasNotice, hari) < 0,
    perlu_konfirmasi_auto_renew: dipantau && !!k.perpanjangan_otomatis && sisa <= 0,
  };
}

/** Kembalikan pesan error (string) bila transisi tidak sah, atau null bila boleh. */
export function cekTransisi(k, ke, catatan) {
  if (!(TRANSISI[k.status] || []).includes(ke)) {
    return `Transisi dari "${k.status}" ke "${ke}" tidak diizinkan.`;
  }
  // Alasan wajib untuk pengembalian/pembatalan/pemutusan; mengajukan draf ke Legal tidak butuh alasan.
  if (WAJIB_ALASAN.has(ke) && k.status !== 'draft' && !String(catatan || '').trim()) return 'Alasan wajib diisi.';
  if (k.status === 'draft' && ke === 'dibatalkan' && !String(catatan || '').trim()) return 'Alasan wajib diisi.';
  if (k.status === 'draft' && ke === 'review_legal') {
    const kurang = ['judul', 'jenis_dokumen', 'counterparty_id', 'divisi_id', 'ruang_lingkup'].filter((f) => !k[f]);
    if (kurang.length) return `Lengkapi dulu: ${kurang.join(', ')}.`;
  }
  if (ke === 'aktif') {
    const kurang = ['tautan_dokumen_final', 'nomor_kontrak', 'tanggal_ttd', 'tanggal_mulai', 'tanggal_berakhir']
      .filter((f) => !k[f]);
    if (kurang.length) return `Status Aktif butuh dokumen final bertanda tangan dan data lengkap: ${kurang.join(', ')}.`;
  }
  return null;
}

/** Hasil job harian: kontrak yang harus menjadi 'berakhir' (auto-renew butuh konfirmasi Legal, tidak ikut). */
export const harusBerakhir = (k, hari) =>
  PANTAU.includes(k.status) && !!k.tanggal_berakhir && !k.perpanjangan_otomatis && selisihHari(k.tanggal_berakhir, hari) <= 0;
