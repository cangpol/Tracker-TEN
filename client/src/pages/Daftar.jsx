import { useEffect, useState } from 'react';
import { get } from '../api.js';
import { Ikon, Tingkat, StatusLencana, Tanda, Status, useData, useSaya, bisa, tanggal, sisaTeks, uang, STATUS_LABEL } from '../ui.jsx';

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
              <thead><tr><th>Kontrak</th><th>Divisi / PIC</th><th>Status</th><th>Berakhir</th><th>Sisa</th><th>Tingkat</th>{adaNilai && <th>Nilai</th>}</tr></thead>
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
