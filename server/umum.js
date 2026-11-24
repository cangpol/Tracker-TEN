export class Galat extends Error {
  constructor(status, kode, pesan) { super(pesan); this.status = status; this.kode = kode; }
}
export const tolak = (pesan, status = 400, kode = 'tidak_valid') => { throw new Galat(status, kode, pesan); };

/** Bungkus handler async agar galat masuk ke penanganan error (Express 4 tidak menangkap rejection). */
export const jalankan = (fn) => (req, res, next) => { Promise.resolve().then(() => fn(req, res)).catch(next); };

export const tanggalSah = (t) =>
  typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(Date.parse(t)) && new Date(t).toISOString().slice(0, 10) === t;

/** Terjemahkan galat constraint PostgreSQL ke pesan pengguna. */
export function galatDb(e) {
  if (e.code === '23505' && /nomor/.test(e.constraint ?? '')) return new Galat(409, 'duplikat', 'Nomor kontrak sudah dipakai.');
  if (e.code === '23505') return new Galat(409, 'duplikat', 'Data sudah ada.');
  if (e.code === '23514') return new Galat(400, 'tidak_valid', 'Tanggal berakhir harus setelah tanggal mulai dan angka tidak boleh negatif.');
  if (e.code === '23503') return new Galat(400, 'tidak_valid', 'Data rujukan (mis. divisi) tidak ditemukan.');
  return e;
}
