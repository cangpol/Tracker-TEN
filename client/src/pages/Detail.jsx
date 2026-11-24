import { useState } from 'react';
import { get, kirim } from '../api.js';
import { Ikon, Tingkat, StatusLencana, Tanda, Status, useData, tanggal, waktu, sisaTeks, STATUS_LABEL } from '../ui.jsx';

const BERISIKO = ['diputus', 'dibatalkan', 'arsip'];
const BUTUH_ALASAN = ['draft', 'review_legal', 'dibatalkan', 'diputus'];

const ALUR = [['draft', 'Draft'], ['review_legal', 'Review Legal'], ['review_finance', 'Review Finance'], ['persetujuan_direksi', 'Persetujuan Direksi'], ['menunggu_ttd', 'Menunggu TTD'], ['aktif', 'Aktif']];
const POSISI = { dibatalkan: 0, negosiasi_perpanjangan: 5, berakhir: 5, diputus: 5, arsip: 5 };

/** Stepper alur status. Langkah Finance/Direksi yang tidak pernah dilalui ditandai 'dilewati'. */
function Alur({ k }) {
  const sekarang = POSISI[k.status] ?? ALUR.findIndex(([s]) => s === k.status);
  const dilalui = new Set(k.riwayat_status.map((r) => r.status_baru));
  return (
    <ol className="langkah" aria-label="Alur status">
      {ALUR.map(([s, label], i) => {
        const kelas = i < sekarang ? (dilalui.has(s) || i === 0 ? 'selesai' : 'lewati') : i === sekarang ? (k.status === s ? 'sekarang' : 'selesai') : '';
        return <li key={s} className={kelas} aria-current={kelas === 'sekarang' ? 'step' : undefined}>{label}{kelas === 'lewati' && <span className="sr"> (tidak tercatat)</span>}</li>;
      })}
    </ol>
  );
}

const hariKe = (t) => Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10));

/** Bar masa kontrak: porsi berjalan + penanda batas notice. */
function Masa({ k }) {
  if (k.progres_masa === null) return null;
  const total = hariKe(k.tanggal_berakhir) - hariKe(k.tanggal_mulai);
  const notice = k.masa_pemberitahuan_hari ? Math.max(0, Math.min(1, (hariKe(k.tanggal_batas_notice) - hariKe(k.tanggal_mulai)) / total)) : null;
  const persen = Math.round(k.progres_masa * 100);
  return (
    <div>
      <div className="masa" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={persen} aria-label="Masa kontrak yang sudah berjalan">
        <div className="isi-masa" style={{ width: `${persen}%` }} />
        {notice !== null && <span className="penanda" style={{ left: `${notice * 100}%` }}>Batas notice</span>}
      </div>
      <div className="masa-ujung"><span>{tanggal(k.tanggal_mulai)}</span><strong>{persen}% berjalan</strong><span>{tanggal(k.tanggal_berakhir)}</span></div>
    </div>
  );
}

function Info({ k }) {
  const baris = [
    ['Jenis dokumen', k.jenis_dokumen], ['Nomor kontrak', k.nomor_kontrak || '—'], ['Counterparty', k.counterparty_nama],
    ['Divisi', k.divisi_nama], ['PIC', k.pic_nama], ['Tingkat risiko', k.tingkat_risiko],
    ['Tanggal TTD', tanggal(k.tanggal_ttd)], ['Tanggal mulai', tanggal(k.tanggal_mulai)], ['Tanggal berakhir', tanggal(k.tanggal_berakhir)],
    ['Masa pemberitahuan', `${k.masa_pemberitahuan_hari} hari`],
    ['Batas notice', k.masa_pemberitahuan_hari ? tanggal(k.tanggal_batas_notice) : '—'],
    ['Perpanjangan otomatis', k.perpanjangan_otomatis ? 'Ya' : 'Tidak'], ['Siklus perpanjangan', k.siklus_perpanjangan],
  ];
  return (
    <dl className="info">
      {baris.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}
      <div><dt>Dokumen final bertanda tangan</dt><dd>
        {k.tautan_dokumen_final
          ? <a href={k.tautan_dokumen_final} target="_blank" rel="noopener noreferrer"><Ikon n="luar" /> Buka dokumen</a>
          : 'Belum ada tautan'}
      </dd></div>
      <div style={{ gridColumn: '1 / -1' }}><dt>Ruang lingkup</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{k.ruang_lingkup || '—'}</dd></div>
      {k.catatan && <div style={{ gridColumn: '1 / -1' }}><dt>Catatan</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{k.catatan}</dd></div>}
    </dl>
  );
}

function UbahStatus({ k, selesai }) {
  const [ke, setKe] = useState('');
  const [catatan, setCatatan] = useState('');
  const [galat, setGalat] = useState('');
  const [proses, setProses] = useState(false);
  // Negosiasi -> aktif hanya lewat form perpanjangan (aturan bisnis).
  const pilihan = k.transisi_tersedia;
  if (!pilihan.length) return <p style={{ margin: 0, color: 'var(--muted)' }}>Tidak ada perubahan status yang tersedia untuk status ini.</p>;

  const simpan = async (e) => {
    e.preventDefault();
    if (BERISIKO.includes(ke) && !confirm(`Ubah status ke "${STATUS_LABEL[ke]}"? Tindakan ini tercatat di riwayat.`)) return;
    setProses(true); setGalat('');
    try { await kirim('POST', `/kontrak/${k.id}/transisi`, { ke, catatan }); setKe(''); setCatatan(''); selesai(); }
    catch (err) { setGalat(err.message); } finally { setProses(false); }
  };
  return (
    <form className="tumpuk" onSubmit={simpan}>
      {galat && <p className="galat" role="alert">{galat}</p>}
      <label>Ubah status ke
        <select value={ke} onChange={(e) => setKe(e.target.value)} required>
          <option value="">Pilih status…</option>
          {pilihan.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </label>
      <label>Catatan {BUTUH_ALASAN.includes(ke) && k.status !== 'draft' || ke === 'dibatalkan' ? '(wajib)' : '(opsional)'}
        <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={5000} />
      </label>
      <div><button className="btn utama" disabled={proses || !ke}>Simpan status</button></div>
    </form>
  );
}

function Perpanjang({ k, selesai }) {
  const [baru, setBaru] = useState('');
  const [catatan, setCatatan] = useState('');
  const [galat, setGalat] = useState('');
  const [proses, setProses] = useState(false);
  const simpan = async (e) => {
    e.preventDefault();
    setProses(true); setGalat('');
    try { await kirim('POST', `/kontrak/${k.id}/perpanjangan`, { tanggal_berakhir_baru: baru, catatan }); setBaru(''); setCatatan(''); selesai(); }
    catch (err) { setGalat(err.message); } finally { setProses(false); }
  };
  return (
    <form className="tumpuk" onSubmit={simpan}>
      {galat && <p className="galat" role="alert">{galat}</p>}
      <label>Tanggal berakhir baru<input type="date" value={baru} min={k.tanggal_berakhir} onChange={(e) => setBaru(e.target.value)} required /></label>
      <label>Catatan (opsional)<textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={5000} /></label>
      <div><button className="btn utama" disabled={proses}><Ikon n="ulang" />Catat perpanjangan</button></div>
    </form>
  );
}

export default function Detail({ id }) {
  const s = useData(() => get(`/kontrak/${id}`), [id]);
  const k = s.data;
  const pantau = k && ['aktif', 'negosiasi_perpanjangan'].includes(k.status);

  return (
    <>
      <p><a href="#/kontrak">← Daftar kontrak</a></p>
      <Status s={s} />
      {k && (
        <>
          <div className="kepala">
            <div>
              <h1>{k.judul}</h1>
              <div className="baris" style={{ marginTop: 8 }}><StatusLencana status={k.status} /><Tingkat tingkat={k.tingkat} /></div>
              <Tanda k={k} />
            </div>
            <a className="btn" href={`#/kontrak/${k.id}/ubah`}>Ubah data</a>
          </div>

          {pantau && k.tingkat && (
            <p className={`ringkas ${k.tingkat}`} role="status">
              <Ikon n={k.tingkat === 'merah' ? 'tutup' : k.tingkat === 'hijau' ? 'ok' : 'waspada'} />
              {k.sisa_hari <= 0 ? `Masa berlaku sudah habis (${sisaTeks(k.sisa_hari)}).` : `Sisa masa berlaku ${k.sisa_hari} hari, berakhir ${tanggal(k.tanggal_berakhir)}.`}
              {k.notice_terlewat && ' Batas pemberitahuan sudah lewat.'}
            </p>
          )}

          <div className="tumpuk">
            <section className="kartu"><h2>Alur status</h2><Alur k={k} />{k.progres_masa !== null && <><h2 style={{ margin: '22px 0 0' }}>Masa kontrak</h2><Masa k={k} /></>}</section>
            <section className="kartu"><h2>Informasi</h2><Info k={k} /></section>

            <div className="dua" style={{ marginBottom: 0 }}>
              <section className="kartu"><h2 style={{ marginBottom: 14 }}>Progres status</h2><UbahStatus k={k} selesai={s.muatUlang} /></section>
              {pantau && <section className="kartu"><h2 style={{ marginBottom: 14 }}>Perpanjangan</h2><Perpanjang k={k} selesai={s.muatUlang} /></section>}
            </div>

            <section className="kartu">
              <h2 style={{ marginBottom: 14 }}>Riwayat</h2>
              <ol className="garis">
                {k.riwayat_status.map((r) => (
                  <li key={r.id}>
                    <strong>{r.status_lama ? `${STATUS_LABEL[r.status_lama]} → ` : ''}{STATUS_LABEL[r.status_baru]}</strong>
                    <div className="sub">{waktu(r.waktu)} · {r.pelaku_nama || 'Sistem'}</div>
                    {r.catatan && <div>{r.catatan}</div>}
                  </li>
                ))}
              </ol>
              {k.perpanjangan.length > 0 && (
                <>
                  <h3 style={{ margin: '18px 0 10px' }}>Perpanjangan</h3>
                  <ol className="garis">
                    {k.perpanjangan.map((p) => (
                      <li key={p.id}>
                        <strong>Siklus {p.siklus}: {tanggal(p.tanggal_berakhir_lama)} → {tanggal(p.tanggal_berakhir_baru)}</strong>
                        <div className="sub">{waktu(p.waktu)}</div>
                        {p.catatan && <div>{p.catatan}</div>}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
