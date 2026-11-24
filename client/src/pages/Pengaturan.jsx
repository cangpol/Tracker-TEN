import { useEffect, useState } from 'react';
import { get, kirim } from '../api.js';
import { Ikon, Status, useData, useSaya, bisa } from '../ui.jsx';

const PENERIMA = { pic: 'PIC divisi', legal: 'Legal', direksi: 'Direksi' };
const ACUAN = { berakhir: 'Tanggal berakhir', notice: 'Batas notice' };

/** Pesan sukses/galat bersama untuk tiap bagian. */
function useAksi() {
  const [pesan, setPesan] = useState(''); const [galat, setGalat] = useState(''); const [proses, setProses] = useState(false);
  const jalan = async (fn, ok) => {
    setPesan(''); setGalat(''); setProses(true);
    try { const r = await fn(); if (ok) setPesan(ok); return r; } catch (e) { setGalat(e.message); return undefined; } finally { setProses(false); }
  };
  return { pesan, galat, proses, jalan };
}
const Umpan = ({ a }) => (<>{a.galat && <p className="galat" role="alert">{a.galat}</p>}{a.pesan && <p className="lencana hijau" role="status">{a.pesan}</p>}</>);

function Divisi() {
  const s = useData(() => get('/divisi'), []);
  const a = useAksi();
  const [f, setF] = useState({ kode: '', nama: '' });
  const tambah = async (e) => {
    e.preventDefault();
    if (await a.jalan(() => kirim('POST', '/divisi', f), 'Divisi ditambahkan.')) { setF({ kode: '', nama: '' }); s.muatUlang(); }
  };
  const ubah = async (d, body, ok) => { if (await a.jalan(() => kirim('PATCH', `/divisi/${d.id}`, body), ok)) s.muatUlang(); };
  return (
    <section className="kartu tumpuk" aria-labelledby="h-divisi">
      <div><h2 id="h-divisi">Divisi</h2><p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>Divisi yang dinonaktifkan tidak muncul di pilihan baru, tetapi kontrak lama tetap utuh.</p></div>
      <Umpan a={a} /><Status s={s} />
      {s.data && (
        <div className="tabel-bungkus"><table>
          <thead><tr><th>Kode</th><th>Nama</th><th>Pengguna aktif</th><th>Kontrak</th><th>Status</th><th><span className="sr">Aksi</span></th></tr></thead>
          <tbody>{s.data.map((d) => (
            <tr key={d.id} style={d.aktif ? undefined : { opacity: 0.6 }}>
              <td><strong>{d.kode}</strong></td><td>{d.nama}</td><td>{d.pengguna_aktif}</td><td>{d.kontrak}</td>
              <td>{d.aktif ? <span className="lencana hijau">Aktif</span> : <span className="lencana netral">Nonaktif</span>}</td>
              <td><div className="baris">
                <button className="btn kecil" disabled={a.proses} onClick={() => { const n = prompt('Nama baru divisi:', d.nama); if (n && n.trim()) ubah(d, { nama: n.trim() }, 'Nama divisi diubah.'); }}>Ubah nama</button>
                <button className="btn kecil" disabled={a.proses} onClick={() => ubah(d, { aktif: !d.aktif }, d.aktif ? 'Divisi dinonaktifkan.' : 'Divisi diaktifkan.')}>{d.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
              </div></td>
            </tr>))}</tbody></table></div>
      )}
      <form className="form" onSubmit={tambah}>
        <h3>Tambah divisi</h3>
        <div className="kelompok">
          <label>Kode<small>2–10 karakter, huruf besar/angka</small><input value={f.kode} onChange={(e) => setF({ ...f, kode: e.target.value.toUpperCase() })} required maxLength={10} /></label>
          <label>Nama<input value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} required maxLength={100} /></label>
        </div>
        <div><button className="btn utama" disabled={a.proses}><Ikon n="tambah" />Tambah divisi</button></div>
      </form>
    </section>
  );
}

function AturanReminder() {
  const s = useData(() => get('/aturan-reminder'), []);
  const a = useAksi();
  const [f, setF] = useState({ acuan: 'berakhir', hari_sebelum: 14, peran_penerima: 'pic' });
  const tambah = async (e) => {
    e.preventDefault();
    if (await a.jalan(() => kirim('POST', '/aturan-reminder', { ...f, hari_sebelum: Number(f.hari_sebelum) }), 'Aturan ditambahkan.')) s.muatUlang();
  };
  const ubah = async (r, body) => { if (await a.jalan(() => kirim('PATCH', `/aturan-reminder/${r.id}`, body), 'Aturan diperbarui.')) s.muatUlang(); };
  return (
    <section className="kartu tumpuk" aria-labelledby="h-aturan">
      <div><h2 id="h-aturan">Aturan reminder</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>Pengingat dikirim pada H-sekian dari tanggal acuan. Bila beberapa aturan terlewat sekaligus (mis. sistem mati), penerima hanya mendapat satu pengingat terbaru. Aturan tidak dihapus, hanya dinonaktifkan, agar riwayat pengiriman tetap bermakna.</p></div>
      <Umpan a={a} /><Status s={s} />
      {s.data && (
        <div className="tabel-bungkus"><table>
          <thead><tr><th>Acuan</th><th>Hari sebelum</th><th>Penerima</th><th>Status</th><th><span className="sr">Aksi</span></th></tr></thead>
          <tbody>{s.data.map((r) => (
            <tr key={r.id} style={r.aktif ? undefined : { opacity: 0.6 }}>
              <td>{ACUAN[r.acuan]}</td><td>H-{r.hari_sebelum}</td><td>{PENERIMA[r.peran_penerima]}</td>
              <td>{r.aktif ? <span className="lencana hijau">Aktif</span> : <span className="lencana netral">Nonaktif</span>}</td>
              <td><div className="baris">
                <button className="btn kecil" disabled={a.proses} onClick={() => { const n = prompt('Hari sebelum (1–3650):', r.hari_sebelum); if (n) ubah(r, { hari_sebelum: Number(n) }); }}>Ubah hari</button>
                <button className="btn kecil" disabled={a.proses} onClick={() => ubah(r, { aktif: !r.aktif })}>{r.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
              </div></td>
            </tr>))}</tbody></table></div>
      )}
      <form className="form" onSubmit={tambah}>
        <h3>Tambah aturan</h3>
        <div className="kelompok">
          <label>Acuan<select value={f.acuan} onChange={(e) => setF({ ...f, acuan: e.target.value })}>{Object.entries(ACUAN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Hari sebelum<input type="number" min="1" max="3650" value={f.hari_sebelum} onChange={(e) => setF({ ...f, hari_sebelum: e.target.value })} required /></label>
          <label>Penerima<select value={f.peran_penerima} onChange={(e) => setF({ ...f, peran_penerima: e.target.value })}>{Object.entries(PENERIMA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        <div><button className="btn utama" disabled={a.proses}><Ikon n="tambah" />Tambah aturan</button></div>
      </form>
    </section>
  );
}

function Ambang() {
  const s = useData(() => get('/pengaturan'), []);
  const a = useAksi();
  const [f, setF] = useState(null);
  useEffect(() => { if (s.data) setF(s.data); }, [s.data]);
  const simpan = async (e) => {
    e.preventDefault();
    if (await a.jalan(() => kirim('PATCH', '/pengaturan', f), 'Pengaturan disimpan.')) s.muatUlang();
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <section className="kartu tumpuk" aria-labelledby="h-amb">
      <div><h2 id="h-amb">Ambang dan aturan bisnis</h2><p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>Berlaku segera di seluruh aplikasi. Perubahan tercatat di audit log (tanpa nilainya).</p></div>
      <Umpan a={a} /><Status s={s} />
      {f && (
        <form className="form" onSubmit={simpan}>
          <div className="kelompok">
            <label>Batas kuning (hari)<small>Sisa ≤ nilai ini = perlu perhatian</small><input type="number" min="1" max="3650" value={f.batas_kuning_hari} onChange={set('batas_kuning_hari')} required /></label>
            <label>Batas oranye (hari)<small>Sisa ≤ nilai ini = segera perpanjang</small><input type="number" min="1" max="3650" value={f.batas_oranye_hari} onChange={set('batas_oranye_hari')} required /></label>
            <label>Ambang persetujuan Direksi<small>Nilai kontrak ≥ angka ini wajib disetujui Direksi. 0 = nonaktif (risiko tinggi tetap wajib).</small>
              <input inputMode="decimal" value={f.ambang_direksi} onChange={set('ambang_direksi')} required pattern="\d{1,16}(\.\d{1,2})?" /></label>
            <label className="lebar">Domain tautan dokumen yang diizinkan<small>Pisahkan dengan koma. Subdomain ikut diizinkan.</small>
              <input value={f.domain_tautan_diizinkan} onChange={set('domain_tautan_diizinkan')} required /></label>
          </div>
          <div><button className="btn utama" disabled={a.proses}>{a.proses ? 'Menyimpan…' : 'Simpan pengaturan'}</button></div>
        </form>
      )}
    </section>
  );
}

export default function Pengaturan() {
  const saya = useSaya();
  return (
    <>
      <div className="kepala"><div><h1>Pengaturan</h1><p>Sesuai peran Anda: {saya.peran_label}.</p></div></div>
      <div className="tumpuk">
        {bisa(saya, 'kelola_divisi') && <Divisi />}
        {bisa(saya, 'kelola_master_bisnis') && <Ambang />}
        {bisa(saya, 'kelola_master_bisnis') && <AturanReminder />}
      </div>
    </>
  );
}
