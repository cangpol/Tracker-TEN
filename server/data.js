// Akses data kontrak yang dipakai bersama oleh rute, laporan, dan job.
import { hitung, hariIni } from './logika.js';
import { boleh, dalamCakupan } from './akses.js';

const ADA_DOK = (kat) => `EXISTS (SELECT 1 FROM dokumen x WHERE x.kontrak_id = k.id AND x.kategori = '${kat}' AND x.diarsipkan_pada IS NULL)`;

export const SELECT_KONTRAK = `SELECT k.*, c.nama AS counterparty_nama, d.nama AS divisi_nama,
  ${ADA_DOK('final_ttd')} AS punya_final, ${ADA_DOK('draft')} AS punya_draft,
  (SELECT x.id FROM dokumen x WHERE x.kontrak_id = k.id AND x.kategori = 'final_ttd' AND x.diarsipkan_pada IS NULL ORDER BY x.versi DESC LIMIT 1) AS dokumen_final_id
  FROM kontrak k JOIN counterparty c ON c.id = k.counterparty_id JOIN divisi d ON d.id = k.divisi_id`;

/** Ambang dari tabel pengaturan (tidak di-hardcode). */
export async function ambang(db) {
  const baris = await db.q('SELECT kunci, nilai FROM pengaturan');
  const m = Object.fromEntries(baris.map((r) => [r.kunci, r.nilai]));
  return { kuning: Number(m.batas_kuning_hari), oranye: Number(m.batas_oranye_hari), direksi: Number(m.ambang_direksi) || 0 };
}

export const domainDiizinkan = async (db) => {
  const r = await db.satu("SELECT nilai FROM pengaturan WHERE kunci = 'domain_tautan_diizinkan'");
  return (r?.nilai ?? '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
};

const SENSITIF = ['nilai_kontrak', 'mata_uang', 'skema_pembayaran'];

/**
 * Saring kolom per peran SEBELUM dikirim ke klien (kolom sensitif tidak pernah keluar dari server untuk peran tanpa hak).
 * Pembuka dokumen: Finance hanya untuk kontrak bernilai.
 */
export function saring(user, k) {
  const o = { ...k };
  if (!boleh(user.peran, 'lihat_nilai')) for (const f of SENSITIF) delete o[f];
  const bolehBuka = boleh(user.peran, 'buka_dokumen') && (user.peran !== 'finance' || Number(k.nilai_kontrak) > 0);
  if (!bolehBuka) delete o.dokumen_final_id;
  delete o.dibuat_oleh;
  return o;
}

export const perkaya = (k, hari, amb) => ({ ...k, ...hitung(k, hari, amb) });

/** Semua kontrak tidak diarsipkan dalam cakupan pengguna, lengkap dengan bidang turunan (tanpa saring kolom). */
export async function semuaAktif(db, user) {
  const hari = hariIni(); const amb = await ambang(db);
  const baris = await db.q(`${SELECT_KONTRAK} WHERE k.diarsipkan_pada IS NULL`);
  return baris.filter((k) => dalamCakupan(user, k)).map((k) => perkaya(k, hari, amb));
}

/** Filter daftar kontrak: dipakai daftar di layar dan ekspor agar hasilnya konsisten. */
export function filterKontrak(daftar, query) {
  const { q = '', status = '', divisi_id = '', tingkat = '', jenis = '', rentang = '', perlu = '' } = query;
  const kata = String(q).toLowerCase();
  return daftar.filter((k) =>
    (!kata || [k.judul, k.nomor_kontrak, k.counterparty_nama].some((v) => String(v ?? '').toLowerCase().includes(kata))) &&
    (!status || k.status === status) &&
    (!divisi_id || k.divisi_id === Number(divisi_id)) &&
    (!tingkat || k.tingkat === tingkat) &&
    (!jenis || k.jenis_dokumen === jenis) &&
    (!rentang || k.rentang === rentang) &&
    (perlu !== 'notice' || k.notice_terlewat) &&
    (perlu !== 'auto_renew' || k.perlu_konfirmasi_auto_renew));
}

export const URUTAN = {
  sisa_hari: (k) => k.sisa_hari ?? Infinity,
  judul: (k) => k.judul.toLowerCase(),
  diubah: (k) => -new Date(k.diubah_pada).getTime(),
};
