// Isi data demo fiktif ke database di DATABASE_URL. Hanya untuk lingkungan demo/lokal.
process.env.DEMO_MODE = '1';
const { bukaDb } = await import('./db.js');
const { siapkan } = await import('./siapkan.js');
const db = bukaDb();
await siapkan(db);
console.log('Data demo siap (idempoten: dilewati bila akun demo sudah ada).');
await db.tutup();
