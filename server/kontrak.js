// Rute kontrak: data, status/persetujuan, perpanjangan, dokumen, dashboard, ekspor.
import { boleh, terbatasDivisi, tolakPelaku, bolehUbah, dalamCakupan } from './akses.js';
import { cekTransisi, transisiTersedia, hariIni, selisihHari, rentang } from './logika.js';
import { SELECT_KONTRAK, ambang, domainDiizinkan, saring, perkaya, semuaAktif, filterKontrak, URUTAN } from './data.js';
import { tolak, tanggalSah, galatDb } from './umum.js';
import { penerimaPeran, buatNotifikasi } from './notifikasi.js';

const JENIS = ['MoU', 'PKS', 'NDA', 'SPK', 'kontrak_vendor'];
const RISIKO = ['rendah', 'sedang', 'tinggi'];
const JENIS_KONTRAK = ['pendapatan', 'pengeluaran', 'non_finansial'];
const KATEGORI = ['draft', 'final_ttd', 'adendum', 'laporan', 'bukti_lain'];
const TEKS = { nomor_kontrak: 100, judul: 255, ruang_lingkup: 5000, pic_nama: 150, catatan: 5000, skema_pembayaran: 2000 };
const TANGGAL = ['tanggal_ttd', 'tanggal_mulai', 'tanggal_berakhir'];
const NILAI = ['nilai_kontrak', 'mata_uang', 'skema_pembayaran'];
const KOLOM_TULIS = ['nomor_kontrak', 'judul', 'jenis_dokumen', 'ruang_lingkup', 'counterparty_id', 'divisi_id', 'pic_nama', ...TANGGAL,
  'perpanjangan_otomatis', 'masa_pemberitahuan_hari', 'tingkat_risiko', 'nilai_kontrak', 'mata_uang', 'jenis_kontrak', 'skema_pembayaran', 'catatan'];
const PANTAU = ['aktif', 'negosiasi_perpanjangan'];

const LABEL = {
  draft: 'Draft', review_legal: 'Review Legal', review_finance: 'Review Finance', persetujuan_direksi: 'Persetujuan Direksi',
  menunggu_ttd: 'Menunggu TTD', aktif: 'Aktif', negosiasi_perpanjangan: 'Negosiasi Perpanjangan', berakhir: 'Berakhir',
  diputus: 'Diputus', dibatalkan: 'Dibatalkan', arsip: 'Arsip',
};
const TAHAP = { review_legal: 'legal', review_finance: 'finance', persetujuan_direksi: 'direksi' };
const STATUS_PERAN = { legal: 'review_legal', finance: 'review_finance', direksi: 'persetujuan_direksi' };
// Efek samping transisi: siapa diberi tahu (BREAKDOWN bagian 4).
const EFEK = {
  'draft>review_legal': ['legal'], 'review_legal>draft': ['pic'], 'review_legal>review_finance': ['finance'],
  'review_legal>persetujuan_direksi': ['direksi'], 'review_legal>menunggu_ttd': ['pic'],
  'review_finance>review_legal': ['legal'], 'review_finance>persetujuan_direksi': ['direksi'], 'review_finance>menunggu_ttd': ['legal', 'pic'],
  'persetujuan_direksi>menunggu_ttd': ['legal', 'pic'], 'persetujuan_direksi>review_legal': ['legal'],
  'aktif>negosiasi_perpanjangan': ['legal'], 'aktif>diputus': ['legal', 'pic'],
};

/** Saring dan validasi input kontrak. Hanya kolom yang diizinkan yang lolos. */
function bersihkan(b, penuh, user) {
  const o = {};
  for (const [f, maks] of Object.entries(TEKS)) {
    if (b[f] === undefined) continue;
    const v = b[f] === null ? '' : String(b[f]).trim();
    if (v.length > maks) tolak(`Kolom ${f} terlalu panjang (maks ${maks} karakter).`);
    o[f] = v || null;
  }
  if (NILAI.some((f) => b[f] !== undefined) && !boleh(user.peran, 'ubah_nilai')) tolak('Anda tidak berwenang mengubah nilai kontrak.', 403, 'dilarang');
  if (b.nilai_kontrak !== undefined) {
    const v = b.nilai_kontrak === null ? '' : String(b.nilai_kontrak).trim();
    if (v && !/^\d{1,16}(\.\d{1,2})?$/.test(v)) tolak('Nilai kontrak harus angka tanpa pemisah ribuan, maks 2 desimal (mis. 1500000 atau 1500000.50).');
    o.nilai_kontrak = v || null;
  }
  if (b.mata_uang !== undefined) {
    const v = String(b.mata_uang ?? '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(v)) tolak('Mata uang harus kode 3 huruf (mis. IDR).');
    o.mata_uang = v;
  }
  if (b.jenis_dokumen !== undefined) { if (!JENIS.includes(b.jenis_dokumen)) tolak('Jenis dokumen tidak valid.'); o.jenis_dokumen = b.jenis_dokumen; }
  if (b.tingkat_risiko !== undefined) { if (!RISIKO.includes(b.tingkat_risiko)) tolak('Tingkat risiko tidak valid.'); o.tingkat_risiko = b.tingkat_risiko; }
  if (b.jenis_kontrak !== undefined) { if (!JENIS_KONTRAK.includes(b.jenis_kontrak)) tolak('Jenis kontrak tidak valid.'); o.jenis_kontrak = b.jenis_kontrak; }
  for (const f of TANGGAL) {
    if (b[f] === undefined) continue;
    if (b[f] === null || b[f] === '') o[f] = null;
    else if (tanggalSah(b[f])) o[f] = b[f];
    else tolak(`Tanggal ${f} harus berformat YYYY-MM-DD.`);
  }
  if (b.masa_pemberitahuan_hari !== undefined) {
    const n = Number(b.masa_pemberitahuan_hari);
    if (!Number.isInteger(n) || n < 0 || n > 3650) tolak('Masa pemberitahuan harus bilangan bulat 0–3650 hari.');
    o.masa_pemberitahuan_hari = n;
  }
  if (b.perpanjangan_otomatis !== undefined) o.perpanjangan_otomatis = !!b.perpanjangan_otomatis;
  if (b.divisi_id !== undefined) {
    const n = Number(b.divisi_id);
    if (!Number.isInteger(n)) tolak('Divisi tidak valid.');
    o.divisi_id = n;
  }
  if (b.counterparty_nama !== undefined) {
    const v = String(b.counterparty_nama).trim();
    if (!v || v.length > 200) tolak('Nama counterparty wajib diisi (maks 200 karakter).');
    o.counterparty_nama = v;
  }
  if (penuh) for (const f of ['judul', 'jenis_dokumen', 'divisi_id', 'pic_nama', 'counterparty_nama']) if (!o[f]) tolak(`Kolom ${f} wajib diisi.`);
  for (const f of ['judul', 'pic_nama']) if (f in o && !o[f]) tolak(`Kolom ${f} wajib diisi.`);
  return o;
}

const cariCounterparty = async (t, nama) => {
  const normal = nama.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return (await t.satu('INSERT INTO counterparty (nama, nama_normal) VALUES ($1,$2) ON CONFLICT (nama_normal) DO UPDATE SET nama = counterparty.nama RETURNING id', [nama, normal])).id;
};

/** Pembuka dokumen: Finance hanya final/adendum untuk kontrak bernilai (BREAKDOWN bagian 2). */
const bolehLihatDok = (u, k, kategori) =>
  boleh(u.peran, 'buka_dokumen') && (u.peran !== 'finance' || (Number(k.nilai_kontrak) > 0 && ['final_ttd', 'adendum'].includes(kategori)));

const csvSel = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  // Netralkan rumus (CSV injection): sel diawali = + - @ tab atau CR diberi apostrof. Angka dilewatkan sebagai teks apa adanya.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function pasangKontrak(api, { db, catat, izin }) {
  const ambilKontrak = async (id, user, q = db) => {
    const n = Number(id);
    const k = Number.isInteger(n) ? await q.satu(`${SELECT_KONTRAK} WHERE k.id = $1`, [n]) : null;
    if (!k || k.diarsipkan_pada || !dalamCakupan(user, k)) tolak('Kontrak tidak ditemukan.', 404, 'tidak_ditemukan');
    return k;
  };
  const tampil = async (id, u) => saring(u, perkaya(await ambilKontrak(id, u), hariIni(), await ambang(db)));

  // ---------- Daftar, tambah, detail, ubah ----------
  api.get('/kontrak', izin('lihat_kontrak'), async (req, res, next) => {
    try {
      const u = req.pengguna;
      const halaman = Math.max(1, parseInt(req.query.halaman, 10) || 1);
      const per = 25;
      const f = URUTAN[req.query.urut] || URUTAN.sisa_hari;
      const daftar = filterKontrak(await semuaAktif(db, u), req.query).sort((a, b) => (f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0));
      const amb = await ambang(db);
      // Menu ubah status per baris: hanya tahap yang sah untuk kondisi kontrak dan peran pengguna (aturan yang sama dengan halaman detail).
      const baris = daftar.slice((halaman - 1) * per, halaman * per).map((k) => ({ ...saring(u, k), transisi_tersedia: transisiTersedia(k, amb).filter((ke) => !tolakPelaku(u, k, ke)) }));
      res.json({ total: daftar.length, halaman, per_halaman: per, data: baris });
    } catch (e) { next(e); }
  });

  api.post('/kontrak', izin('tambah_kontrak'), async (req, res, next) => {
    try {
      const u = req.pengguna;
      if (terbatasDivisi(u.peran) && !u.divisi_id) tolak('Akun PIC Anda belum memiliki divisi. Hubungi administrator.', 403, 'dilarang');
      // PIC selalu membuat kontrak di divisinya sendiri, apa pun isi permintaan.
      const d = bersihkan(terbatasDivisi(u.peran) ? { ...req.body, divisi_id: u.divisi_id } : (req.body ?? {}), true, u);
      const id = await db.tx(async (t) => {
        d.counterparty_id = await cariCounterparty(t, d.counterparty_nama);
        const kolom = KOLOM_TULIS.filter((c) => d[c] !== undefined);
        const r = await t.satu(
          `INSERT INTO kontrak (${kolom.join(',')}, dibuat_oleh) VALUES (${kolom.map((_, i) => `$${i + 1}`).join(',')}, $${kolom.length + 1}) RETURNING id`,
          [...kolom.map((c) => d[c]), u.id]);
        await t.jalankan("INSERT INTO riwayat_status (kontrak_id, status_lama, status_baru, pelaku_id) VALUES ($1,NULL,'draft',$2)", [r.id, u.id]);
        await catat(req, 'kontrak_dibuat', 'kontrak', r.id, null, t);
        return r.id;
      }).catch((e) => { throw galatDb(e); });
      res.status(201).json(await tampil(id, u));
    } catch (e) { next(e); }
  });

  api.get('/kontrak/:id', izin('lihat_kontrak'), async (req, res, next) => {
    try {
      const u = req.pengguna;
      const amb = await ambang(db);
      const k = perkaya(await ambilKontrak(req.params.id, u), hariIni(), amb);
      const dok = (await db.q(`SELECT d.id, d.kategori, d.nama, d.versi, d.diunggah_pada, p.nama AS diunggah_nama FROM dokumen d
        LEFT JOIN pengguna p ON p.id = d.diunggah_oleh WHERE d.kontrak_id = $1 AND d.diarsipkan_pada IS NULL ORDER BY d.kategori, d.versi DESC`, [k.id]))
        .filter((d) => bolehLihatDok(u, k, d.kategori));
      res.json({
        ...saring(u, k),
        transisi_tersedia: transisiTersedia(k, amb).filter((ke) => !tolakPelaku(u, k, ke)),
        bisa_ubah: bolehUbah(u, k),
        bisa_ubah_nilai: boleh(u.peran, 'ubah_nilai'),
        bisa_perpanjang: boleh(u.peran, 'catat_perpanjangan') && PANTAU.includes(k.status),
        bisa_unggah: boleh(u.peran, 'unggah_dokumen'),
        bisa_arsip_dokumen: boleh(u.peran, 'arsip_dokumen'),
        dokumen: dok,
        riwayat_status: await db.q(`SELECT r.id, r.status_lama, r.status_baru, r.waktu, r.catatan, p.nama AS pelaku_nama FROM riwayat_status r
          LEFT JOIN pengguna p ON p.id = r.pelaku_id WHERE kontrak_id = $1 ORDER BY r.id DESC`, [k.id]),
        persetujuan: await db.q(`SELECT s.id, s.tahap, s.keputusan, s.waktu, s.catatan, p.nama AS pemberi_nama FROM persetujuan s
          JOIN pengguna p ON p.id = s.pemberi_id WHERE kontrak_id = $1 ORDER BY s.id DESC`, [k.id]),
        perpanjangan: await db.q('SELECT * FROM perpanjangan WHERE kontrak_id = $1 ORDER BY id DESC', [k.id]),
      });
    } catch (e) { next(e); }
  });

  api.patch('/kontrak/:id', izin('ubah_kontrak'), async (req, res, next) => {
    try {
      const u = req.pengguna;
      const lama = await ambilKontrak(req.params.id, u);
      if (!bolehUbah(u, lama)) tolak('Data kontrak ini tidak dapat Anda ubah pada status sekarang.', 403, 'dilarang');
      const masuk = { ...req.body };
      if (terbatasDivisi(u.peran)) delete masuk.divisi_id; // PIC tidak memindahkan kontrak ke divisi lain
      const d = bersihkan(masuk, false, u);
      await db.tx(async (t) => {
        if (d.counterparty_nama) d.counterparty_id = await cariCounterparty(t, d.counterparty_nama);
        delete d.counterparty_nama;
        const kolom = KOLOM_TULIS.filter((c) => d[c] !== undefined);
        if (!kolom.length) tolak('Tidak ada perubahan.');
        // Kontrak aktif tidak boleh kehilangan data wajib status aktif.
        if (PANTAU.includes(lama.status)) {
          const gabung = { ...lama, ...d };
          const kurang = ['nomor_kontrak', 'tanggal_ttd', 'tanggal_mulai', 'tanggal_berakhir'].filter((f) => !gabung[f]);
          if (kurang.length) tolak(`Kontrak berstatus aktif wajib memiliki: ${kurang.join(', ')}.`);
        }
        await t.jalankan(`UPDATE kontrak SET ${kolom.map((c, i) => `${c} = $${i + 1}`).join(', ')}, diubah_pada = now() WHERE id = $${kolom.length + 1}`,
          [...kolom.map((c) => d[c]), lama.id]);
        // Catat nama kolom saja, bukan nilainya (nilai kontrak sensitif).
        await catat(req, 'kontrak_diubah', 'kontrak', lama.id, `kolom: ${kolom.join(',')}`, t);
      }).catch((e) => { throw galatDb(e); });
      res.json(await tampil(lama.id, u));
    } catch (e) { next(e); }
  });

  // ---------- Status dan persetujuan ----------
  api.post('/kontrak/:id/transisi', izin('lihat_kontrak'), async (req, res, next) => {
    try {
      const u = req.pengguna;
      const amb = await ambang(db);
      const k = await ambilKontrak(req.params.id, u);
      const ke = String(req.body?.ke ?? '');
      const catatan = String(req.body?.catatan ?? '').trim().slice(0, 5000);
      const pesan = cekTransisi(k, ke, catatan, amb);
      if (pesan) { await catat(req, 'transisi_ditolak', 'kontrak', k.id, `${k.status}->${ke}`); tolak(pesan, 409, 'transisi_tidak_sah'); }
      const larangan = tolakPelaku(u, k, ke);
      if (larangan) { await catat(req, 'transisi_dilarang', 'kontrak', k.id, `${k.status}->${ke}`); tolak(larangan, 403, 'dilarang'); }

      // Langkah mundur dari tahap persetujuan = dikembalikan.
      const kembali = ke === 'draft' || (['review_finance', 'persetujuan_direksi'].includes(k.status) && ke === 'review_legal');
      await db.tx(async (t) => {
        const r = await t.jalankan(
          `UPDATE kontrak SET status = $1, diubah_pada = now(), diarsipkan_pada = CASE WHEN $1 = 'arsip' THEN now() ELSE NULL END WHERE id = $2 AND status = $3`,
          [ke, k.id, k.status]);
        if (!r.rowCount) tolak('Status kontrak baru saja berubah. Muat ulang halaman lalu coba lagi.', 409, 'konflik');
        await t.jalankan('INSERT INTO riwayat_status (kontrak_id, status_lama, status_baru, pelaku_id, catatan) VALUES ($1,$2,$3,$4,$5)', [k.id, k.status, ke, u.id, catatan || null]);
        if (TAHAP[k.status]) {
          await t.jalankan('INSERT INTO persetujuan (kontrak_id, tahap, pemberi_id, keputusan, catatan) VALUES ($1,$2,$3,$4,$5)',
            [k.id, TAHAP[k.status], u.id, kembali ? 'kembalikan' : 'setuju', catatan || null]);
        }
        // Pesan notifikasi minimal: tanpa nilai dan tanpa alasan (alasan hanya di aplikasi).
        const teks = kembali ? `Kontrak ${k.judul} dikembalikan: lihat catatan di aplikasi.`
          : ['review_legal', 'review_finance', 'persetujuan_direksi'].includes(ke) ? `Kontrak ${k.judul} menunggu persetujuan Anda (tahap ${LABEL[ke]}).`
            : `Status kontrak ${k.judul} berubah menjadi ${LABEL[ke]}.`;
        for (const peran of EFEK[`${k.status}>${ke}`] ?? []) {
          const orang = (await penerimaPeran(t, peran, k.divisi_id)).filter((x) => x.id !== u.id).map((x) => x.id);
          await buatNotifikasi(t, orang, { kontrakId: k.id, jenis: 'alur_kerja', pesan: teks });
        }
        await catat(req, 'transisi_status', 'kontrak', k.id, `${k.status}->${ke}`, t);
      });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  api.post('/kontrak/:id/perpanjangan', izin('catat_perpanjangan'), async (req, res, next) => {
    try {
      const u = req.pengguna;
      const k = await ambilKontrak(req.params.id, u);
      if (!PANTAU.includes(k.status)) tolak('Hanya kontrak aktif atau dalam negosiasi yang bisa diperpanjang.', 409, 'transisi_tidak_sah');
      const baru = req.body?.tanggal_berakhir_baru;
      if (!tanggalSah(baru)) tolak('Tanggal berakhir baru harus berformat YYYY-MM-DD.');
      if (selisihHari(baru, k.tanggal_berakhir) <= 0) tolak('Tanggal berakhir baru harus setelah tanggal berakhir lama.');
      const catatan = String(req.body?.catatan ?? '').trim().slice(0, 5000) || null;
      await db.tx(async (t) => {
        const siklus = k.siklus_perpanjangan + 1;
        const r = await t.jalankan("UPDATE kontrak SET tanggal_berakhir = $1, siklus_perpanjangan = $2, status = 'aktif', diubah_pada = now() WHERE id = $3 AND siklus_perpanjangan = $4",
          [baru, siklus, k.id, k.siklus_perpanjangan]);
        if (!r.rowCount) tolak('Kontrak baru saja diperpanjang oleh pengguna lain. Muat ulang halaman.', 409, 'konflik');
        await t.jalankan('INSERT INTO perpanjangan (kontrak_id, siklus, tanggal_berakhir_lama, tanggal_berakhir_baru, dicatat_oleh, catatan) VALUES ($1,$2,$3,$4,$5,$6)',
          [k.id, siklus, k.tanggal_berakhir, baru, u.id, catatan]);
        if (k.status !== 'aktif') {
          await t.jalankan("INSERT INTO riwayat_status (kontrak_id, status_lama, status_baru, pelaku_id, catatan) VALUES ($1,$2,'aktif',$3,'Perpanjangan dicatat')", [k.id, k.status, u.id]);
        }
        await catat(req, 'perpanjangan', 'kontrak', k.id, `${k.tanggal_berakhir}->${baru}`, t);
      });
      res.json(await tampil(k.id, u));
    } catch (e) { next(e); }
  });

  // ---------- Dokumen (tautan; dokumen asli tetap di Drive/SharePoint) ----------
  api.post('/kontrak/:id/dokumen', izin('unggah_dokumen'), async (req, res, next) => {
    try {
      const u = req.pengguna;
      const k = await ambilKontrak(req.params.id, u);
      const kategori = String(req.body?.kategori ?? '');
      const nama = String(req.body?.nama ?? '').trim();
      const lokasi = String(req.body?.lokasi ?? '').trim();
      if (!KATEGORI.includes(kategori)) tolak('Kategori dokumen tidak valid.');
      if (!nama || nama.length > 200) tolak('Nama dokumen wajib diisi (maks 200 karakter).');
      let url;
      try { url = new URL(lokasi); } catch { tolak('Tautan dokumen tidak valid.'); }
      if (url.protocol !== 'https:' || lokasi.length > 2048 || url.username || url.password) tolak('Tautan harus berupa URL https tanpa nama pengguna/sandi.');
      const izinDomain = await domainDiizinkan(db);
      const host = url.hostname.toLowerCase();
      if (izinDomain.length && !izinDomain.some((d) => host === d || host.endsWith(`.${d}`))) {
        tolak(`Domain ${host} tidak diizinkan. Gunakan: ${izinDomain.join(', ')}.`);
      }
      const dok = await db.tx(async (t) => {
        await t.jalankan('SELECT 1 FROM kontrak WHERE id = $1 FOR UPDATE', [k.id]); // serialkan versi per kontrak
        const v = (await t.satu('SELECT COALESCE(MAX(versi), 0)::int AS v FROM dokumen WHERE kontrak_id = $1 AND kategori = $2', [k.id, kategori])).v + 1;
        const r = await t.satu('INSERT INTO dokumen (kontrak_id, kategori, nama, lokasi, versi, diunggah_oleh) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, kategori, nama, versi',
          [k.id, kategori, nama, lokasi, v, u.id]);
        await catat(req, 'dokumen_ditambah', 'dokumen', r.id, `${kategori} v${v}`, t);
        return r;
      });
      res.status(201).json(dok);
    } catch (e) { next(e); }
  });

  // Buka dokumen lewat server: dicatat di audit log (FR-304), lokasi asli tidak dikirim ke tampilan.
  api.get('/dokumen/:id/buka', izin('buka_dokumen'), async (req, res, next) => {
    try {
      const u = req.pengguna;
      const d = await db.satu('SELECT * FROM dokumen WHERE id = $1 AND diarsipkan_pada IS NULL', [Number(req.params.id) || 0]);
      if (!d) tolak('Dokumen tidak ditemukan.', 404, 'tidak_ditemukan');
      const k = await ambilKontrak(d.kontrak_id, u);
      if (!bolehLihatDok(u, k, d.kategori)) tolak('Dokumen tidak ditemukan.', 404, 'tidak_ditemukan');
      await catat(req, 'dokumen_dibuka', 'dokumen', d.id, d.kategori);
      res.redirect(302, d.lokasi);
    } catch (e) { next(e); }
  });

  api.delete('/dokumen/:id', izin('arsip_dokumen'), async (req, res, next) => {
    try {
      const u = req.pengguna;
      const d = await db.satu('SELECT * FROM dokumen WHERE id = $1 AND diarsipkan_pada IS NULL', [Number(req.params.id) || 0]);
      if (!d) tolak('Dokumen tidak ditemukan.', 404, 'tidak_ditemukan');
      const k = await ambilKontrak(d.kontrak_id, u);
      if (d.kategori === 'final_ttd' && PANTAU.includes(k.status)) {
        const sisa = (await db.satu("SELECT count(*)::int AS n FROM dokumen WHERE kontrak_id = $1 AND kategori = 'final_ttd' AND diarsipkan_pada IS NULL AND id <> $2", [k.id, d.id])).n;
        if (!sisa) tolak('Kontrak aktif harus tetap memiliki dokumen final bertanda tangan.', 409, 'konflik');
      }
      await db.jalankan('UPDATE dokumen SET diarsipkan_pada = now() WHERE id = $1', [d.id]);
      await catat(req, 'dokumen_diarsipkan', 'dokumen', d.id, d.kategori);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // ---------- Dashboard ----------
  api.get('/dashboard', izin('lihat_kontrak'), async (req, res, next) => {
    try {
      const u = req.pengguna;
      const hari = hariIni(); const amb = await ambang(db);
      const semua = await semuaAktif(db, u);
      const dipantau = semua.filter((k) => PANTAU.includes(k.status));
      const awal = new Date(`${hari.slice(0, 7)}-01T00:00:00Z`);
      const bulan = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(awal.getUTCFullYear(), awal.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
      const perDivisi = {};
      for (const k of dipantau) perDivisi[k.divisi_nama] = (perDivisi[k.divisi_nama] || 0) + 1;
      const urgensi = (k) => Math.min(k.sisa_hari ?? Infinity, k.masa_pemberitahuan_hari > 0 ? selisihHari(k.tanggal_batas_notice, hari) : Infinity);
      const tahapAnda = STATUS_PERAN[u.peran];
      res.json({
        kartu: {
          total: semua.length,
          aktif: semua.filter((k) => k.status === 'aktif').length,
          segera_berakhir: dipantau.filter((k) => k.mendekati_berakhir).length,
          berakhir: semua.filter((k) => k.status === 'berakhir').length,
          dalam_proses: semua.filter((k) => ['draft', 'review_legal', 'review_finance', 'persetujuan_direksi', 'menunggu_ttd'].includes(k.status)).length,
          notice_terlewat: dipantau.filter((k) => k.notice_terlewat).length,
          perlu_konfirmasi_auto_renew: dipantau.filter((k) => k.perlu_konfirmasi_auto_renew).length,
          // Antrian persetujuan milik peran ini (tidak termasuk yang dibuatnya sendiri, karena tidak boleh disetujui sendiri).
          menunggu_anda: tahapAnda ? semua.filter((k) => k.status === tahapAnda && k.dibuat_oleh !== u.id).length : 0,
        },
        radar: rentang(amb).map(({ id, label, tingkat }) => ({ id, label, tingkat, jumlah: dipantau.filter((k) => k.rentang === id).length })),
        per_status: Object.entries(semua.reduce((a, k) => ({ ...a, [k.status]: (a[k.status] || 0) + 1 }), {})).map(([status, jumlah]) => ({ status, jumlah })),
        per_risiko: ['tinggi', 'sedang', 'rendah'].map((r) => ({ risiko: r, jumlah: dipantau.filter((k) => k.tingkat_risiko === r).length })),
        berakhir_per_bulan: bulan.map((b) => ({ bulan: b, jumlah: dipantau.filter((k) => k.tanggal_berakhir.startsWith(b)).length })),
        per_divisi: Object.entries(perDivisi).map(([divisi, jumlah]) => ({ divisi, jumlah })).sort((a, b) => b.jumlah - a.jumlah),
        // Nilai selalu dikelompokkan per mata uang (tidak dijumlah lintas mata uang) dan dihitung di SQL (numeric, bukan float).
        nilai_aktif: boleh(u.peran, 'lihat_nilai')
          ? await db.q(`SELECT mata_uang, jenis_kontrak, SUM(nilai_kontrak)::text AS total, count(*)::int AS jumlah FROM kontrak
              WHERE status = 'aktif' AND diarsipkan_pada IS NULL AND nilai_kontrak IS NOT NULL GROUP BY 1, 2 ORDER BY 1, 2`)
          : undefined,
        prioritas: dipantau
          .filter((k) => k.sisa_hari <= amb.kuning || k.notice_terlewat || k.perlu_konfirmasi_auto_renew)
          .sort((a, b) => urgensi(a) - urgensi(b)).slice(0, 15).map((k) => saring(u, k)),
      });
    } catch (e) { next(e); }
  });

  // ---------- Ekspor CSV ----------
  api.get('/laporan/ekspor', izin('ekspor'), async (req, res, next) => {
    try {
      const u = req.pengguna;
      let daftar = filterKontrak(await semuaAktif(db, u), req.query).sort((a, b) => (a.sisa_hari ?? Infinity) - (b.sisa_hari ?? Infinity));
      if (u.peran === 'finance') daftar = daftar.filter((k) => Number(k.nilai_kontrak) > 0); // hanya data bernilai
      const nilai = boleh(u.peran, 'lihat_nilai');
      const kolom = [
        ['Nomor kontrak', (k) => k.nomor_kontrak], ['Judul', (k) => k.judul], ['Jenis dokumen', (k) => k.jenis_dokumen], ['Counterparty', (k) => k.counterparty_nama],
        ['Divisi', (k) => k.divisi_nama], ['PIC', (k) => k.pic_nama], ['Status', (k) => LABEL[k.status]], ['Tanggal mulai', (k) => k.tanggal_mulai],
        ['Tanggal berakhir', (k) => k.tanggal_berakhir], ['Sisa hari', (k) => k.sisa_hari], ['Tingkat', (k) => k.tingkat], ['Batas notice', (k) => k.tanggal_batas_notice],
        ['Auto-renew', (k) => (k.perpanjangan_otomatis ? 'Ya' : 'Tidak')], ['Tingkat risiko', (k) => k.tingkat_risiko],
        ...(nilai ? [['Nilai kontrak', (k) => k.nilai_kontrak], ['Mata uang', (k) => k.mata_uang]] : []),
      ];
      const baris = [kolom.map(([h]) => csvSel(h)).join(','), ...daftar.map((k) => kolom.map(([, f]) => csvSel(f(k))).join(','))];
      await catat(req, 'ekspor', 'kontrak', null, `baris=${daftar.length}; nilai=${nilai ? 'ya' : 'tidak'}`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="kontrak-${hariIni()}.csv"`);
      res.send(`﻿${baris.join('\r\n')}\r\n`);
    } catch (e) { next(e); }
  });
}

export { JENIS, RISIKO, JENIS_KONTRAK, KATEGORI, LABEL };
