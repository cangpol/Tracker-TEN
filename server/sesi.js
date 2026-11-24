import session from 'express-session';

const TTL_MS = 8 * 3600 * 1000;

/** Penyimpanan sesi di PostgreSQL: bertahan lintas instance serverless dan restart. */
export class PgStore extends session.Store {
  constructor(db) { super(); this.db = db; }

  get(sid, cb) {
    this.db.satu('SELECT data FROM sesi WHERE sid = $1 AND kedaluwarsa > now()', [sid]).then((r) => cb(null, r ? r.data : null), cb);
  }

  set(sid, sess, cb) {
    const exp = new Date(sess.cookie?.expires ?? Date.now() + TTL_MS);
    this.db.jalankan(
      `INSERT INTO sesi (sid, data, kedaluwarsa) VALUES ($1, $2, $3)
       ON CONFLICT (sid) DO UPDATE SET data = EXCLUDED.data, kedaluwarsa = EXCLUDED.kedaluwarsa`,
      [sid, JSON.stringify(sess), exp],
    ).then(() => {
      // Bersih-bersih kedaluwarsa sesekali, tanpa penjadwal terpisah.
      if (Math.random() < 0.02) this.db.jalankan('DELETE FROM sesi WHERE kedaluwarsa < now()').catch(() => {});
      cb(null);
    }, cb);
  }

  touch(sid, sess, cb) {
    const exp = new Date(sess.cookie?.expires ?? Date.now() + TTL_MS);
    this.db.jalankan('UPDATE sesi SET kedaluwarsa = $2 WHERE sid = $1', [sid, exp]).then(() => cb(null), cb);
  }

  destroy(sid, cb) {
    this.db.jalankan('DELETE FROM sesi WHERE sid = $1', [sid]).then(() => cb(null), cb);
  }
}
