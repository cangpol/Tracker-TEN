import { randomBytes } from 'node:crypto';
import { bukaDb } from './db.js';
import { buatApp, jalankanJobHarian } from './app.js';
import { hashSandi } from './sandi.js';

const db = bukaDb();

// Admin pertama dibuat sekali. Kata sandi acak ditampilkan satu kali, tidak ada kata sandi bawaan.
if (!db.prepare('SELECT 1 FROM pengguna LIMIT 1').get()) {
  const email = (process.env.ADMIN_EMAIL || 'admin@simou.local').toLowerCase();
  const sandi = process.env.ADMIN_PASSWORD || randomBytes(9).toString('base64url');
  db.prepare('INSERT INTO pengguna (nama, email, sandi_hash) VALUES (?, ?, ?)').run('Admin Legal', email, hashSandi(sandi));
  console.log(`\nAkun admin dibuat.\n  Email : ${email}\n  Sandi : ${process.env.ADMIN_PASSWORD ? '(dari ADMIN_PASSWORD)' : sandi}\nSimpan sandi ini sekarang, tidak akan ditampilkan lagi.\n`);
}

const job = () => {
  try { const n = jalankanJobHarian(db); if (n) console.log(`Job harian: ${n} kontrak menjadi berakhir.`); } catch (e) { console.error('job gagal:', e.message); }
};
job();
// shortcut: cek per jam di dalam proses; pindah ke cron/penjadwal OS bila perlu jam tetap (BREAKDOWN bagian 7).
setInterval(job, 3600 * 1000).unref();

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '127.0.0.1';
buatApp(db).listen(port, host, () => console.log(`SiMoU berjalan di http://${host}:${port}`));
