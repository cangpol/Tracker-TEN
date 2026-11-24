import { useEffect, useRef, useState } from 'react';
import { get, kirim } from '../api.js';
import { Ikon, Tingkat, StatusLencana, Tanda, Status, useData, useSaya, bisa, tanggal, sisaTeks, uang, STATUS_LABEL } from '../ui.jsx';

const BUTUH_ALASAN = ['draft', 'review_legal', 'dibatalkan', 'diputus'];
const ALUR = ['draft', 'review_legal', 'review_finance', 'persetujuan_direksi', 'menunggu_ttd', 'aktif'];

/** Menu ubah status per baris. Isinya hanya tahap yang sah menurut server (aturan sama dengan halaman detail). */
function UbahStatus({ k, selesai }) {
  const [ke, setKe] = useState('');
  const [catatan, setCatatan] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');
  const dlg = useRef(null);
  const pilihan = k.transisi_tersedia ?? [];
  const wajib = (BUTUH_ALASAN.includes(ke) && k.status !== 'draft') || ke === 'dibatalkan';
  useEffect(() => { if (ke) dlg.current?.showModal(); }, [ke]);
  if (!pilihan.length) return <span className="sub">—</span>;
  const tutup = () => { dlg.current?.close(); setKe(''); setCatatan(''); setGalat(''); };
  const kirimUbah = async (e) => {
    e.preventDefault(); setProses(true); setGalat('');
    try { await kirim('POST', `/kontrak/${k.id}/transisi`, { ke, catatan }); tutup(); selesai(); }
    catch (x) { setGalat(x.message); } finally { setProses(false); }
  };
  return (
    <>
      <select className="pilih-status" aria-label={`Ubah status ${k.judul}`} value="" onChange={(e) => setKe(e.target.value)}>
        <option value="">Ubah status…</option>
        {pilihan.map((x) => <option key={x} value={x}>{STATUS_LABEL[x] ?? x}</option>)}
      </select>
      <dialog ref={dlg} className="dialog-status" onClose={() => { setKe(''); setCatatan(''); setGalat(''); }}>
        <form onSubmit={kirimUbah}>
          <h2>Ubah status</h2>
          <p><strong>{k.judul}</strong><br />{STATUS_LABEL[k.status]} → {STATUS_LABEL[ke] ?? ke}</p>
          <label>Catatan {wajib ? '(wajib)' : '(opsional)'}
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={5000} required={wajib} />
          </label>
          {galat && <p className="galat" role="alert">{galat}</p>}
          <div className="baris" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn" onClick={tutup}>Batal</button>
            <button className="btn utama" disabled={proses}>{proses ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

const parse = (rute) => Object.fromEntries(new URLSearchParams(rute.split('?')[1] || ''));

export default function Daftar({ rute }) {
  const saya = useSaya();
  const awal = parse(rute);
  const [f, setF] = useState({ q: '', status: '', divisi_id: '', tingkat: '', jenis: '', rentang: '', perlu: '', ...awal });
  const [q, setQ] = useState(f.q);
  const [halaman, setHalaman] = useState(1);
  useEffect(() => { setF((x) => ({ ...x, status: '', tingkat: '', rentang: '', perlu: '', ...parse(rute) })); setHalaman(1); }, [rute]);
  useEffect(() => { const t = setTimeout(() => { setF((x) => ({ ...x, q })); setHalaman(1); }, 300); return () => clearTimeout(t); }, [q]);

  const master = useData(() => get('/master'), []);
  const s = useData(() => get(`/kontrak?${new URLSearchParams({ ...f, halaman })}`), [f.q, f.status, f.divisi_id, f.tingkat, f.jenis, f.rentang, f.perlu, halaman]);
  const d = s.data;
  const ubah = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setHalaman(1); };
  const adaNilai = !!d?.data[0] && 'nilai_kontrak' in d.data[0]; // kolom nilai hanya dikirim server untuk peran berhak
  const halamanMaks = d ? Math.max(1, Math.ceil(d.total / d.per_halaman)) : 1;

  return (
    <>
      <div className="kepala">
        <div><h1>Daftar Kontrak</h1><p>{d ? `${d.total} kontrak` : ' '}</p></div>
        <div className="baris">
          {bisa(saya, 'ekspor') && <a className="btn" href={`/api/v1/laporan/ekspor?${new URLSearchParams(Object.entries(f).filter(([, x]) => x))}`}><Ikon n="unduh" />Ekspor CSV</a>}
          {bisa(saya, 'tambah_kontrak') && <a className="btn utama" href="#/kontrak/baru"><Ikon n="tambah" />Tambah kontrak</a>}
        </div>
      </div>

      <div className="filter" role="search">
        <label>Cari<input type="search" placeholder="Judul, nomor, atau counterparty" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label>Status
          <select value={f.status} onChange={ubah('status')}>
            <option value="">Semua</option>
            {Object.entries(STATUS_LABEL).filter(([k]) => k !== 'arsip').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Divisi
          <select value={f.divisi_id} onChange={ubah('divisi_id')}>
            <option value="">Semua</option>
            {master.data?.divisi.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
          </select>
        </label>
        <label>Jenis
          <select value={f.jenis} onChange={ubah('jenis')}>
            <option value="">Semua</option>
            {master.data?.jenis_dokumen.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label>Tingkat
          <select value={f.tingkat} onChange={ubah('tingkat')}>
            <option value="">Semua</option>
            <option value="hijau">Aman</option><option value="kuning">Perlu perhatian</option>
            <option value="oranye">Segera perpanjang</option><option value="merah">Berakhir</option>
          </select>
        </label>
      </div>

      <div className="alur-chip" role="group" aria-label="Saring menurut tahap alur">
        <button className={`chip-tahap ${f.status === '' ? 'on' : ''}`} onClick={() => ubah('status')({ target: { value: '' } })}>Semua tahap</button>
        {ALUR.map((x, i) => (
          <button key={x} className={`chip-tahap ${f.status === x ? 'on' : ''}`} aria-pressed={f.status === x} onClick={() => ubah('status')({ target: { value: f.status === x ? '' : x } })}>
            <span aria-hidden="true">{i + 1}.</span> {STATUS_LABEL[x]}
          </button>
        ))}
      </div>

      {(f.rentang || f.perlu) && (
        <div className="baris" style={{ marginBottom: 12 }}>
          <span className="lencana aksen">Filter dari dashboard: {f.rentang ? `rentang ${f.rentang === 'lewat' ? 'sudah lewat' : f.rentang === 'aman' ? 'aman' : `≤ ${f.rentang} hari`}` : f.perlu === 'notice' ? 'notice terlewat' : 'konfirmasi auto-renew'}</span>
          <button className="btn kecil" onClick={() => { setF({ ...f, rentang: '', perlu: '' }); location.hash = '#/kontrak'; }}>Hapus filter</button>
        </div>
      )}

      <div className="kartu">
        <Status s={s} />
        {d && (d.data.length === 0 ? (
          <p className="kosong">Tidak ada kontrak yang cocok. Ubah filter atau tambah kontrak baru.</p>
        ) : (
          <div className="tabel-bungkus">
            <table>
              <thead><tr><th>Kontrak</th><th>Divisi / PIC</th><th>Status</th><th>Berakhir</th><th>Sisa</th><th>Tingkat</th><th>Ubah status</th>{adaNilai && <th>Nilai</th>}</tr></thead>
              <tbody>
                {d.data.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <a className="judul" href={`#/kontrak/${k.id}`}>{k.judul}</a>
                      <div className="sub">{k.jenis_dokumen} · {k.counterparty_nama}{k.nomor_kontrak ? ` · ${k.nomor_kontrak}` : ''}</div>
                      <Tanda k={k} />
                    </td>
                    <td>{k.divisi_nama}<div className="sub">{k.pic_nama}</div></td>
                    <td><StatusLencana status={k.status} /></td>
                    <td>{tanggal(k.tanggal_berakhir)}</td>
                    <td>{sisaTeks(k.sisa_hari)}</td>
                    <td><Tingkat tingkat={k.tingkat} /></td>
                    <td><UbahStatus k={k} selesai={s.muatUlang} /></td>
                    {adaNilai && <td style={{ whiteSpace: 'nowrap' }}>{k.nilai_kontrak ? uang(k.nilai_kontrak, k.mata_uang) : '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {d && d.total > d.per_halaman && (
          <div className="baris" style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <button className="btn kecil" disabled={halaman <= 1} onClick={() => setHalaman(halaman - 1)}>Sebelumnya</button>
            <span>Halaman {halaman} dari {halamanMaks}</span>
            <button className="btn kecil" disabled={halaman >= halamanMaks} onClick={() => setHalaman(halaman + 1)}>Berikutnya</button>
          </div>
        )}
      </div>
    </>
  );
}
