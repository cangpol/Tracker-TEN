import { useEffect, useState } from 'react';
import { get, kirim } from '../api.js';
import { Status, useData } from '../ui.jsx';

const KOSONG = {
  judul: '', jenis_dokumen: 'MoU', counterparty_nama: '', divisi_id: '', pic_nama: '', nomor_kontrak: '', ruang_lingkup: '',
  tanggal_ttd: '', tanggal_mulai: '', tanggal_berakhir: '', masa_pemberitahuan_hari: 0, perpanjangan_otomatis: false,
  tingkat_risiko: 'sedang', tautan_dokumen_final: '', catatan: '',
};

export default function Form({ id }) {
  const master = useData(() => get('/master'), []);
  const [v, setV] = useState(KOSONG);
  const [galat, setGalat] = useState('');
  const [proses, setProses] = useState(false);
  const muat = useData(() => (id ? get(`/kontrak/${id}`) : Promise.resolve(null)), [id]);

  useEffect(() => {
    const k = muat.data;
    if (k) setV(Object.fromEntries(Object.keys(KOSONG).map((f) => [f, f === 'perpanjangan_otomatis' ? !!k[f] : f === 'counterparty_nama' ? k.counterparty_nama : (k[f] ?? '')])));
  }, [muat.data]);

  const set = (f) => (e) => setV({ ...v, [f]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const simpan = async (e) => {
    e.preventDefault();
    setProses(true); setGalat('');
    try {
      const hasil = await kirim(id ? 'PATCH' : 'POST', id ? `/kontrak/${id}` : '/kontrak', { ...v, divisi_id: Number(v.divisi_id) });
      location.hash = `#/kontrak/${hasil.id}`;
    } catch (err) { setGalat(err.message); setProses(false); }
  };

  return (
    <>
      <p><a href={id ? `#/kontrak/${id}` : '#/kontrak'}>← Kembali</a></p>
      <div className="kepala"><div><h1>{id ? 'Ubah Kontrak' : 'Tambah Kontrak'}</h1><p>Status baru selalu dimulai dari Draft.</p></div></div>
      <Status s={id ? muat : { memuat: master.memuat, galat: master.galat }} />
      {master.data && (!id || muat.data) && (
        <form className="kartu form" onSubmit={simpan}>
          {galat && <p className="galat" role="alert">{galat}</p>}
          <h2>Identitas</h2>
          <div className="kelompok">
            <label className="lebar">Judul *<input value={v.judul} onChange={set('judul')} required maxLength={255} /></label>
            <label>Jenis dokumen *
              <select value={v.jenis_dokumen} onChange={set('jenis_dokumen')}>{master.data.jenis_dokumen.map((j) => <option key={j}>{j}</option>)}</select>
            </label>
            <label>Nomor kontrak<small>Wajib sebelum status Aktif</small><input value={v.nomor_kontrak} onChange={set('nomor_kontrak')} maxLength={100} /></label>
            <label>Counterparty *<small>Ketik nama baru atau pilih yang ada</small>
              <input list="daftar-cp" value={v.counterparty_nama} onChange={set('counterparty_nama')} required maxLength={200} />
              <datalist id="daftar-cp">{master.data.counterparty.map((n) => <option key={n} value={n} />)}</datalist>
            </label>
            <label>Divisi *
              <select value={v.divisi_id} onChange={set('divisi_id')} required>
                <option value="">Pilih divisi…</option>
                {master.data.divisi.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
              </select>
            </label>
            <label>PIC *<input value={v.pic_nama} onChange={set('pic_nama')} required maxLength={150} /></label>
            <label>Tingkat risiko
              <select value={v.tingkat_risiko} onChange={set('tingkat_risiko')}>{master.data.tingkat_risiko.map((r) => <option key={r}>{r}</option>)}</select>
            </label>
            <label className="lebar">Ruang lingkup<small>Wajib sebelum diajukan ke Review Legal</small><textarea value={v.ruang_lingkup} onChange={set('ruang_lingkup')} maxLength={5000} /></label>
          </div>

          <h2>Masa berlaku</h2>
          <div className="kelompok">
            <label>Tanggal TTD<input type="date" value={v.tanggal_ttd} onChange={set('tanggal_ttd')} /></label>
            <label>Tanggal mulai<input type="date" value={v.tanggal_mulai} onChange={set('tanggal_mulai')} /></label>
            <label>Tanggal berakhir<input type="date" value={v.tanggal_berakhir} onChange={set('tanggal_berakhir')} min={v.tanggal_mulai || undefined} /></label>
            <label>Masa pemberitahuan (hari)<small>Batas notice = tanggal berakhir − masa pemberitahuan</small>
              <input type="number" min="0" max="3650" value={v.masa_pemberitahuan_hari} onChange={set('masa_pemberitahuan_hari')} />
            </label>
            <label className="cek"><input type="checkbox" checked={v.perpanjangan_otomatis} onChange={set('perpanjangan_otomatis')} />Perpanjangan otomatis (auto-renew)</label>
          </div>

          <h2>Dokumen</h2>
          <div className="kelompok">
            <label className="lebar">Tautan dokumen final bertanda tangan<small>URL https (Google Drive/SharePoint). Wajib sebelum status Aktif.</small>
              <input type="url" value={v.tautan_dokumen_final} onChange={set('tautan_dokumen_final')} placeholder="https://" maxLength={2048} />
            </label>
            <label className="lebar">Catatan<textarea value={v.catatan} onChange={set('catatan')} maxLength={5000} /></label>
          </div>

          <div className="baris">
            <button className="btn utama" disabled={proses}>{proses ? 'Menyimpan…' : 'Simpan'}</button>
            <a className="btn" href={id ? `#/kontrak/${id}` : '#/kontrak'}>Batal</a>
          </div>
        </form>
      )}
    </>
  );
}
