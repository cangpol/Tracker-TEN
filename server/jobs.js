// Job terjadwal: status berakhir otomatis dan mesin reminder (BREAKDOWN bagian 7). Keduanya idempoten.
import { hitung, hariIni, harusBerakhir, tanggalPicu, selisihHari } from './logika.js';
import { SELECT_KONTRAK, ambang } from './data.js';
import { buatNotifikasi } from './notifikasi.js';

const AKTIF = "k.diarsipkan_pada IS NULL AND k.status IN ('aktif','negosiasi_perpanjangan')";
const MAKS_PERCOBAAN = 3;
const LABEL_TINGKAT = { merah: 'Berakhir', oranye: 'Segera perpanjang', kuning: 'Perlu perhatian', hijau: 'Aman' };

/** Ubah aktif/negosiasi yang sudah lewat tanggal menjadi 'berakhir' (kecuali auto-renew). Pelaku = sistem. */
export async function jalankanJobBerakhir(db) {
  const hari = hariIni();
  await db.jalankan("INSERT INTO pengaturan (kunci, nilai) VALUES ('job_terakhir', $1) ON CONFLICT (kunci) DO UPDATE SET nilai = EXCLUDED.nilai", [new Date().toISOString()]);
  const baris = await db.q(`SELECT k.* FROM kontrak k WHERE ${AKTIF}`);
  let n = 0;
  for (const k of baris.filter((x) => harusBerakhir(x, hari))) {
    await db.tx(async (t) => {
      // Syarat status di UPDATE mencegah ganda bila dua job berjalan bersamaan.
      const r = await t.jalankan("UPDATE kontrak SET status = 'berakhir', diubah_pada = now() WHERE id = $1 AND status = $2", [k.id, k.status]);
      if (!r.rowCount) return;
      await t.jalankan("INSERT INTO riwayat_status (kontrak_id, status_lama, status_baru, pelaku_id, catatan) VALUES ($1,$2,'berakhir',NULL,'Masa berlaku habis (otomatis)')", [k.id, k.status]);
      await t.jalankan("INSERT INTO audit_log (aksi, objek_tabel, objek_id, ringkasan) VALUES ('job_berakhir','kontrak',$1,$2)", [k.id, `${k.status}->berakhir`]);
      n++;
    });
  }
  return n;
}

const tglPendek = (t) => new Date(`${t}T00:00:00Z`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pesanReminder(k, aturan, h) {
  if (aturan.acuan === 'notice') {
    const sisa = selisihHari(h.tanggal_batas_notice, hariIni());
    return `Batas pemberitahuan ${k.judul} ${sisa < 0 ? 'sudah lewat' : `jatuh pada ${tglPendek(h.tanggal_batas_notice)}`} (${sisa} hari).`;
  }
  return `${k.judul} ${h.sisa_hari <= 0 ? 'sudah berakhir' : `berakhir ${tglPendek(k.tanggal_berakhir)}`} (${h.sisa_hari} hari).`;
}

/**
 * Reminder bertingkat. Untuk tiap (kontrak, penerima): aturan yang sudah jatuh tempo dan belum tercatat → hanya yang
 * paling mendesak dikirim, sisanya ditandai 'dilewati' (catch-up sekali, bukan berulang). Kunci unik menjaga idempotensi.
 * `kirimEmail` opsional; bila null, hanya notifikasi dalam aplikasi.
 */
export async function jalankanReminder(db, { kirimEmail = null, urlApp = process.env.APP_URL || '' } = {}) {
  const hari = hariIni(); const amb = await ambang(db);
  const aturan = await db.q('SELECT * FROM aturan_reminder WHERE aktif ORDER BY hari_sebelum, id');
  const pengguna = await db.q('SELECT id, nama, email, peran, divisi_id FROM pengguna WHERE aktif');
  const kontrak = await db.q(`${SELECT_KONTRAK} WHERE ${AKTIF}`);
  const digest = new Map(); // penerima_id → { orang, butir: [{k, aturan, h}] }
  let notifikasiBaru = 0;

  for (const k of kontrak) {
    const h = hitung(k, hari, amb);
    const jatuhTempo = aturan.filter((a) => { const p = tanggalPicu(k, a); return p && hari >= p; });
    if (!jatuhTempo.length) continue;
    const sudah = new Set((await db.q("SELECT aturan_id, penerima_id FROM pengiriman_notifikasi WHERE kontrak_id = $1 AND siklus = $2 AND kanal = 'app'", [k.id, k.siklus_perpanjangan]))
      .map((r) => `${r.aturan_id}:${r.penerima_id}`));
    const perOrang = new Map();
    for (const a of jatuhTempo) {
      const sasaran = pengguna.filter((u) => (a.peran_penerima === 'pic' ? u.peran === 'pic' && u.divisi_id === k.divisi_id : u.peran === a.peran_penerima));
      for (const u of sasaran) if (!sudah.has(`${a.id}:${u.id}`)) perOrang.set(u.id, [...(perOrang.get(u.id) ?? []), a]);
    }
    for (const [uid, belum] of perOrang) {
      const pilih = belum[0]; // `aturan` urut hari_sebelum menaik, jadi yang paling mendesak lebih dulu
      await db.tx(async (t) => {
        let terkirim = false;
        for (const a of belum) {
          const r = await t.jalankan(
            `INSERT INTO pengiriman_notifikasi (kontrak_id, aturan_id, siklus, penerima_id, kanal, status) VALUES ($1,$2,$3,$4,'app',$5)
             ON CONFLICT DO NOTHING`, [k.id, a.id, k.siklus_perpanjangan, uid, a === pilih ? 'terkirim' : 'dilewati']);
          if (a === pilih && r.rowCount) terkirim = true;
        }
        if (!terkirim) return;
        await buatNotifikasi(t, [uid], { kontrakId: k.id, jenis: pilih.acuan === 'notice' ? 'reminder_notice' : 'reminder_berakhir', pesan: pesanReminder(k, pilih, h) });
        notifikasiBaru++;
        const orang = pengguna.find((u) => u.id === uid);
        if (kirimEmail && orang.email) {
          const d = digest.get(uid) ?? { orang, butir: [] };
          d.butir.push({ k, aturan: pilih, h });
          digest.set(uid, d);
        }
      });
    }
  }

  const email = kirimEmail ? await kirimDigest(db, kirimEmail, digest, urlApp, hari, amb) : { email_terkirim: 0, email_gagal: 0 };
  return { notifikasi_baru: notifikasiBaru, ...email };
}

/** Satu email per penerima per hari. Yang gagal sebelumnya diulang (maks 3 percobaan) bersama butir baru. */
async function kirimDigest(db, kirimEmail, digest, urlApp, hari, amb) {
  const ulang = await db.q("SELECT id, kontrak_id, aturan_id, penerima_id FROM pengiriman_notifikasi WHERE kanal = 'email' AND status = 'gagal' AND percobaan < $1", [MAKS_PERCOBAAN]);
  const penggunaById = Object.fromEntries((await db.q('SELECT id, nama, email FROM pengguna WHERE aktif')).map((u) => [u.id, u]));
  const gabung = new Map([...digest].map(([uid, d]) => [uid, { orang: d.orang, butir: [...d.butir] }]));
  for (const r of ulang) {
    const k = await db.satu(`${SELECT_KONTRAK} WHERE k.id = $1`, [r.kontrak_id]);
    const orang = penggunaById[r.penerima_id];
    if (!k || !orang) continue;
    const d = gabung.get(orang.id) ?? { orang, butir: [] };
    d.butir.push({ k, aturan: { id: r.aturan_id }, h: hitung(k, hari, amb), pid: r.id });
    gabung.set(orang.id, d);
  }

  let terkirim = 0; let gagal = 0;
  for (const { orang, butir } of gabung.values()) {
    const urut = [...butir].sort((a, b) => (a.h.sisa_hari ?? 0) - (b.h.sisa_hari ?? 0));
    const baris = urut.map((b) => `${b.k.judul} — ${b.k.counterparty_nama} — berakhir ${tglPendek(b.k.tanggal_berakhir)} (${b.h.sisa_hari} hari) — ${LABEL_TINGKAT[b.h.tingkat] ?? ''}`);
    const penutup = 'Tautan di atas hanya dapat dibuka setelah login. Jangan teruskan email ini ke pihak luar.';
    const pesan = {
      to: orang.email,
      subject: `[Partnership TEN] Ringkasan kontrak: ${butir.length} perlu perhatian`,
      text: `Halo ${orang.nama},\n\n${baris.map((b) => `- ${b}`).join('\n')}\n\n${urlApp ? `Buka aplikasi: ${urlApp}\n\n` : ''}${penutup}`,
      html: `<p>Halo ${esc(orang.nama)},</p><ul>${baris.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>${urlApp ? `<p><a href="${esc(urlApp)}">Buka aplikasi</a></p>` : ''}<p style="color:#555">${penutup}</p>`,
    };
    let ok = true;
    try { await kirimEmail(pesan); } catch (e) { ok = false; console.error('email gagal:', e.message); }
    if (ok) terkirim++; else gagal++;
    for (const b of butir) {
      if (b.pid) {
        await db.jalankan('UPDATE pengiriman_notifikasi SET status = $2, percobaan = percobaan + 1, dikirim_pada = now() WHERE id = $1', [b.pid, ok ? 'terkirim' : 'gagal']);
      } else {
        await db.jalankan(
          "INSERT INTO pengiriman_notifikasi (kontrak_id, aturan_id, siklus, penerima_id, kanal, status) VALUES ($1,$2,$3,$4,'email',$5) ON CONFLICT DO NOTHING",
          [b.k.id, b.aturan.id, b.k.siklus_perpanjangan, orang.id, ok ? 'terkirim' : 'gagal']);
      }
    }
  }
  return { email_terkirim: terkirim, email_gagal: gagal };
}
