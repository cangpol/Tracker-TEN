// Notifikasi dalam aplikasi (lonceng): penerima, pembuatan, dan endpoint baca.

/** Pengguna aktif dengan peran tertentu. PIC dibatasi ke divisi kontrak. `q` = db atau transaksi. */
export function penerimaPeran(q, peran, divisiId) {
  if (peran === 'pic') return q.q("SELECT id, nama, email FROM pengguna WHERE aktif AND peran = 'pic' AND divisi_id = $1", [divisiId]);
  return q.q('SELECT id, nama, email FROM pengguna WHERE aktif AND peran = $1', [peran]);
}

export async function buatNotifikasi(q, idPenerima, { kontrakId = null, jenis, pesan }) {
  for (const id of new Set(idPenerima)) {
    await q.jalankan('INSERT INTO notifikasi_app (penerima_id, kontrak_id, jenis, pesan) VALUES ($1,$2,$3,$4)', [id, kontrakId, jenis, pesan]);
  }
}

export function pasangNotifikasi(api, { db, jalankan, tolak }) {
  api.get('/notifikasi', jalankan(async (req, res) => {
    const id = req.pengguna.id;
    res.json({
      belum_dibaca: (await db.satu('SELECT count(*)::int AS n FROM notifikasi_app WHERE penerima_id = $1 AND dibaca_pada IS NULL', [id])).n,
      data: await db.q('SELECT id, kontrak_id, jenis, pesan, dibaca_pada, dibuat_pada FROM notifikasi_app WHERE penerima_id = $1 ORDER BY id DESC LIMIT 50', [id]),
    });
  }));

  api.post('/notifikasi/baca-semua', jalankan(async (req, res) => {
    await db.jalankan('UPDATE notifikasi_app SET dibaca_pada = now() WHERE penerima_id = $1 AND dibaca_pada IS NULL', [req.pengguna.id]);
    res.json({ ok: true });
  }));

  api.post('/notifikasi/:id/baca', jalankan(async (req, res) => {
    const r = await db.jalankan('UPDATE notifikasi_app SET dibaca_pada = COALESCE(dibaca_pada, now()) WHERE id = $1 AND penerima_id = $2', [Number(req.params.id), req.pengguna.id]);
    if (!r.rowCount) tolak('Notifikasi tidak ditemukan.', 404, 'tidak_ditemukan'); // milik orang lain dianggap tidak ada
    res.json({ ok: true });
  }));
}
