// Persiapan sistem saat start (lokal) atau cold start (Vercel): migrasi, admin pertama, data demo. Aman dipanggil berulang.
import { randomBytes } from 'node:crypto';
import { migrasi } from './db.js';
import { hashSandi } from './sandi.js';
import { isiDemo } from './demo.js';
import { jalankanReminder } from './jobs.js';

export async function siapkan(db) {
  await migrasi(db);

  if (!(await db.satu("SELECT 1 FROM pengguna WHERE peran = 'admin_sistem' AND NOT demo LIMIT 1"))) {
    const email = (process.env.ADMIN_EMAIL || 'sistem@partnership-ten.local').toLowerCase();
    let sandi = process.env.ADMIN_PASSWORD;
    const acak = !sandi && !process.env.VERCEL && process.env.DEMO_MODE !== '1';
    if (acak) sandi = randomBytes(9).toString('base64url'); // hanya lokal: ditampilkan sekali di terminal
    if (sandi) {
      const r = await db.satu("INSERT INTO pengguna (nama, email, sandi_hash, peran, wajib_ganti) VALUES ('Admin Sistem', $1, $2, 'admin_sistem', true) ON CONFLICT (email) DO NOTHING RETURNING id",
        [email, hashSandi(sandi)]);
      if (r) console.log(`\nAkun Admin Sistem dibuat.\n  Email : ${email}\n  Sandi : ${acak ? sandi : '(dari ADMIN_PASSWORD)'}\nSandi wajib diganti saat login pertama.\n`);
    } else if (process.env.DEMO_MODE !== '1') {
      console.warn('Belum ada Admin Sistem. Atur ADMIN_EMAIL dan ADMIN_PASSWORD lalu jalankan ulang.');
    }
  }

  if (process.env.DEMO_MODE === '1') {
    const baru = await db.tx(async (t) => {
      await t.jalankan('SELECT pg_advisory_xact_lock(727002)'); // cold start bersamaan tidak mengisi dua kali
      return isiDemo(t);
    });
    if (baru) await jalankanReminder(db); // lonceng demo langsung berisi
  }
}
