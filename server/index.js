import { bukaDb } from './db.js';
import { siapkan } from './siapkan.js';
import { buatApp } from './app.js';
import { buatPengirimEmail } from './email.js';
import { jalankanJobBerakhir, jalankanReminder } from './jobs.js';

const db = bukaDb();
await siapkan(db);
const kirimEmail = buatPengirimEmail();

const job = async () => {
  try {
    const n = await jalankanJobBerakhir(db);
    const r = await jalankanReminder(db, { kirimEmail });
    if (n || r.notifikasi_baru) console.log(`Job: ${n} kontrak berakhir, ${r.notifikasi_baru} notifikasi baru.`);
  } catch (e) { console.error('job gagal:', e.message); }
};
await job();
// Lokal: cek per jam di dalam proses (idempoten). Di Vercel dipakai Vercel Cron (lihat vercel.json).
setInterval(job, 3600 * 1000).unref();

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '127.0.0.1';
buatApp(db, { kirimEmail }).listen(port, host, () => console.log(`Partnership TEN berjalan di http://${host}:${port}`));
