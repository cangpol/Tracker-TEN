// Satu-satunya tempat aturan hak akses (BREAKDOWN bagian 2). Server yang memutuskan; tampilan hanya mengikuti.

export const PERAN = ['admin_sistem', 'legal', 'pic', 'finance', 'direksi', 'viewer'];
// Pemberian peran ini butuh persetujuan orang kedua (four-eyes).
export const ISTIMEWA = ['admin_sistem', 'legal', 'finance', 'direksi'];

export const LABEL_PERAN = {
  admin_sistem: 'Super Admin (Admin Sistem)', legal: 'Legal', pic: 'PIC Unit', finance: 'Finance', direksi: 'HQ / TEN (Direksi)', viewer: 'Auditor (Viewer)',
};

const IZIN = {
  lihat_kontrak: ['legal', 'pic', 'finance', 'direksi', 'viewer'],
  tambah_kontrak: ['legal', 'pic'],
  ubah_kontrak: ['legal', 'pic'],
  catat_perpanjangan: ['legal'],
  kelola_pengguna: ['admin_sistem'],
  lihat_audit: ['admin_sistem', 'legal'],
  dashboard_sistem: ['admin_sistem'],
  lihat_nilai: ['legal', 'finance', 'direksi'],
  ubah_nilai: ['legal'],
  unggah_dokumen: ['legal', 'pic'],
  buka_dokumen: ['legal', 'pic', 'finance', 'direksi'],
  arsip_dokumen: ['legal'],
  kelola_divisi: ['admin_sistem'],
  kelola_master_bisnis: ['legal'],
  ekspor: ['legal', 'pic', 'finance', 'direksi'],
};

export const boleh = (peran, aksi) => !!IZIN[aksi]?.includes(peran);
export const izinPeran = (peran) => Object.keys(IZIN).filter((a) => boleh(peran, a));

/** Peran yang hanya boleh melihat kontrak divisinya sendiri. */
export const terbatasDivisi = (peran) => peran === 'pic';

// Siapa boleh melakukan transisi (BREAKDOWN bagian 4). 'berakhir' hanya oleh job sistem.
const OLEH = {
  'draft>review_legal': ['pic', 'legal'], 'draft>dibatalkan': ['pic', 'legal'],
  'review_legal>draft': ['legal'], 'review_legal>review_finance': ['legal'],
  'review_legal>persetujuan_direksi': ['legal'], 'review_legal>menunggu_ttd': ['legal'],
  'review_finance>review_legal': ['finance'], 'review_finance>persetujuan_direksi': ['finance'], 'review_finance>menunggu_ttd': ['finance'],
  'persetujuan_direksi>menunggu_ttd': ['direksi'], 'persetujuan_direksi>review_legal': ['direksi'],
  'menunggu_ttd>aktif': ['legal'],
  'aktif>negosiasi_perpanjangan': ['pic', 'legal'], 'aktif>diputus': ['direksi'],
  'berakhir>arsip': ['legal'], 'diputus>arsip': ['legal'], 'dibatalkan>arsip': ['legal'],
};
// Tahap yang bersifat persetujuan: pelaku tidak boleh sama dengan pembuat kontrak (ATURAN bagian 6 butir 6).
const TAHAP_SETUJU = new Set(['review_legal', 'review_finance', 'persetujuan_direksi']);

export const bolehTransisi = (peran, dari, ke) => !!OLEH[`${dari}>${ke}`]?.includes(peran);

/** Alasan transisi ditolak karena orangnya (bukan karena status), atau null. */
export function tolakPelaku(user, k, ke) {
  if (!bolehTransisi(user.peran, k.status, ke)) return 'Peran Anda tidak berwenang melakukan perubahan status ini.';
  if (TAHAP_SETUJU.has(k.status) && k.dibuat_oleh && k.dibuat_oleh === user.id) {
    return 'Penyetuju tidak boleh sama dengan pembuat kontrak. Minta orang lain menyetujui.';
  }
  return null;
}

// PIC hanya boleh mengubah data sebelum status Menunggu TTD.
export const STATUS_PIC_BOLEH_UBAH = ['draft', 'review_legal', 'review_finance', 'persetujuan_direksi'];

export function bolehUbah(user, k) {
  if (!boleh(user.peran, 'ubah_kontrak')) return false;
  return user.peran !== 'pic' || STATUS_PIC_BOLEH_UBAH.includes(k.status);
}

/** Kontrak di luar cakupan divisi dianggap tidak ada (404) agar keberadaannya tidak bocor. */
export const dalamCakupan = (user, k) => !terbatasDivisi(user.peran) || (user.divisi_id != null && k.divisi_id === user.divisi_id);

// Penjelasan singkat per peran untuk kartu akun demo di halaman depan.
export const RINGKAS_PERAN = {
  admin_sistem: 'Kelola pengguna, peran, dan kesehatan sistem. Tidak dapat melihat isi kontrak.',
  legal: 'Kelola semua kontrak, setujui tahap Legal, catat perpanjangan, atur reminder.',
  pic: 'Input dan ubah kontrak divisinya sendiri, ajukan ke Legal, tambah dokumen.',
  finance: 'Tinjau kontrak bernilai, lihat nilai kontrak, setujui tahap Finance.',
  direksi: 'Pantau seluruh kontrak, setujui tahap Direksi, putuskan kontrak.',
  viewer: 'Baca saja: pantau status dan masa berlaku tanpa nilai dan dokumen.',
};
