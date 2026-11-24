// Titik masuk Vercel: satu fungsi serverless untuk seluruh /api/*. Aplikasi dan pool dibuat sekali per instance.
import { bukaDb } from '../server/db.js';
import { siapkan } from '../server/siapkan.js';
import { buatApp } from '../server/app.js';
import { buatPengirimEmail } from '../server/email.js';

let siap;
const ambil = () => {
  siap ??= (async () => {
    const db = bukaDb();
    await siapkan(db);
    return buatApp(db, { kirimEmail: buatPengirimEmail() });
  })().catch((e) => { siap = undefined; throw e; }); // gagal start: coba lagi di permintaan berikutnya
  return siap;
};

export default async function handler(req, res) {
  try {
    return (await ambil())(req, res);
  } catch (e) {
    console.error('start gagal:', e.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ kode: 'galat', pesan: 'Terjadi kesalahan pada server.' }));
  }
}
