import { useState } from 'react';
import { get, kirim } from '../api.js';
import { Ikon, Status, useData, useSaya, waktu } from '../ui.jsx';

const KOSONG = { nama: '', email: '', peran: 'viewer', divisi_id: '' };

/** Sandi sementara: tampil sekali, tidak disimpan di mana pun di klien setelah ditutup. */
function SandiSementara({ info, tutup }) {
  const [salin, setSalin] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(info.sandi); setSalin(true); } catch { setSalin(false); } };
  return (
    <section className="kartu sandi-kotak" role="status" aria-labelledby="h-sandi">
      <h2 id="h-sandi"><Ikon n="kunci" /> Sandi sementara untuk {info.nama}</h2>
      <p style={{ margin: '6px 0 10px' }}>Sampaikan lewat jalur aman. Sandi ini <strong>hanya tampil sekali</strong> dan wajib diganti saat login pertama.</p>
      <div className="baris"><code>{info.sandi}</code>
        <button className="btn kecil" onClick={copy}>{salin ? 'Tersalin' : 'Salin'}</button>
        <button className="btn kecil" onClick={tutup}>Sudah saya catat, tutup</button></div>
    </section>
  );
}

export default function Pengguna() {
  const saya = useSaya();
  const s = useData(() => get('/pengguna'), []);
  const master = useData(() => get('/master'), []);
  const [f, setF] = useState(KOSONG);
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState(null);
  const [pesan, setPesan] = useState('');
  const [proses, setProses] = useState(false);
  const d = s.data;
  const perluDivisi = f.peran === 'pic';
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const jalan = async (fn, ok) => {
    setGalat(''); setPesan(''); setProses(true);
    try { const r = await fn(); if (ok) setPesan(ok(r)); s.muatUlang(); return r; }
    catch (e) { setGalat(e.message); } finally { setProses(false); }
  };

  const tambah = async (e) => {
    e.preventDefault();
    const r = await jalan(() => kirim('POST', '/pengguna', { ...f, divisi_id: perluDivisi ? Number(f.divisi_id) : undefined }),
      (x) => (x.menunggu_persetujuan ? 'Akun dibuat sebagai Viewer. Peran istimewa menunggu persetujuan Admin Sistem lain.' : 'Akun dibuat.'));
    if (r) { setInfo({ nama: r.pengguna.nama, sandi: r.sandi_sementara }); setF(KOSONG); }
  };
  const reset = async (p) => {
    if (!confirm(`Reset kata sandi ${p.nama}? Sandi lama langsung tidak berlaku.`)) return;
    const r = await jalan(() => kirim('POST', `/pengguna/${p.id}/reset-sandi`));
    if (r) setInfo({ nama: p.nama, sandi: r.sandi_sementara });
  };
  const aktifkan = (p, aktif) => {
    if (!aktif && !confirm(`Nonaktifkan ${p.nama}? Sesi yang sedang berjalan langsung berakhir.`)) return;
    return jalan(() => kirim('PATCH', `/pengguna/${p.id}`, { aktif }), () => (aktif ? 'Akun diaktifkan.' : 'Akun dinonaktifkan.'));
  };
  const ubahPeran = (p, peran) => {
    const divisi = peran === 'pic' && !p.divisi_id ? prompt('PIC harus punya divisi. Masukkan ID divisi:\n' + master.data?.divisi.map((x) => `${x.id} = ${x.nama}`).join('\n')) : undefined;
    if (peran === 'pic' && !p.divisi_id && !divisi) return;
    return jalan(() => kirim('PATCH', `/pengguna/${p.id}`, { peran, ...(divisi ? { divisi_id: Number(divisi) } : {}) }),
      (x) => (x.menunggu_persetujuan ? 'Perubahan peran istimewa menunggu persetujuan Admin Sistem lain.' : 'Peran diubah.'));
  };
  const putus = (r, keputusan) => jalan(() => kirim('POST', `/permintaan-peran/${r.id}/${keputusan}`), () => (keputusan === 'setujui' ? 'Peran disetujui.' : 'Permintaan ditolak.'));

  return (
    <>
      <div className="kepala"><div><h1>Pengguna dan peran</h1><p>Admin Sistem mengelola akun. Peran Legal, Finance, Direksi, dan Admin Sistem memerlukan persetujuan Admin Sistem lain.</p></div></div>
      <Status s={s} />
      {galat && <p className="galat" role="alert" style={{ marginBottom: 14 }}>{galat}</p>}
      {pesan && <p className="lencana hijau" role="status" style={{ marginBottom: 14 }}>{pesan}</p>}
      {info && <SandiSementara info={info} tutup={() => setInfo(null)} />}

      {d && d.permintaan.length > 0 && (
        <section className="kartu" style={{ margin: '14px 0' }} aria-labelledby="h-antrian">
          <h2 id="h-antrian">Menunggu persetujuan ({d.permintaan.length})</h2>
          <div className="tabel-bungkus"><table>
            <thead><tr><th>Pengguna</th><th>Perubahan peran</th><th>Diminta oleh</th><th>Waktu</th><th><span className="sr">Aksi</span></th></tr></thead>
            <tbody>{d.permintaan.map((r) => (
              <tr key={r.id}>
                <td>{r.pengguna_nama}</td>
                <td><span className="lencana netral">{d.peran.find((p) => p.id === r.peran_lama)?.label}</span> → <span className="lencana aksen">{d.peran.find((p) => p.id === r.peran_baru)?.label}</span></td>
                <td>{r.diminta_nama}</td><td>{waktu(r.waktu)}</td>
                <td>{r.diminta_oleh === saya.id
                  ? <span className="sub">Menunggu admin lain</span>
                  : <div className="baris"><button className="btn kecil utama" disabled={proses} onClick={() => putus(r, 'setujui')}>Setujui</button>
                    <button className="btn kecil" disabled={proses} onClick={() => putus(r, 'tolak')}>Tolak</button></div>}</td>
              </tr>))}</tbody></table></div>
        </section>
      )}

      <div className="tumpuk" style={{ marginTop: 14 }}>
        <section className="kartu" aria-labelledby="h-daftar">
          <h2 id="h-daftar">Daftar pengguna {d && `(${d.pengguna.length})`}</h2>
          {d && (
            <div className="tabel-bungkus"><table>
              <thead><tr><th>Pengguna</th><th>Peran</th><th>Status</th><th>Login terakhir</th><th><span className="sr">Aksi</span></th></tr></thead>
              <tbody>{d.pengguna.map((p) => (
                <tr key={p.id} style={p.aktif ? undefined : { opacity: 0.6 }}>
                  <td><strong>{p.nama}</strong><div className="sub">{p.email}</div>{p.divisi_nama && <div className="sub">{p.divisi_nama}</div>}</td>
                  <td>
                    <label className="sr" htmlFor={`peran-${p.id}`}>Peran {p.nama}</label>
                    <select id={`peran-${p.id}`} value={p.peran} disabled={proses || p.id === saya.id || !p.aktif} onChange={(e) => ubahPeran(p, e.target.value)} style={{ minHeight: 36, width: "auto", minWidth: 170 }}>
                      {d.peran.map((x) => <option key={x.id} value={x.id}>{x.label}{x.istimewa ? ' *' : ''}</option>)}
                    </select>
                  </td>
                  <td>{p.aktif ? <span className="lencana hijau">Aktif</span> : <span className="lencana netral">Nonaktif</span>}
                    {p.wajib_ganti ? <div className="tanda"><span className="lencana kuning">Belum ganti sandi</span></div> : null}</td>
                  <td>{p.terakhir_login ? waktu(p.terakhir_login) : <span className="sub">Belum pernah</span>}</td>
                  <td>{p.id === saya.id ? <span className="sub">Akun Anda</span> : (
                    <div className="baris">
                      {p.aktif && <button className="btn kecil" disabled={proses} onClick={() => reset(p)}>Reset sandi</button>}
                      <button className="btn kecil" disabled={proses} onClick={() => aktifkan(p, !p.aktif)}>{p.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                    </div>)}</td>
                </tr>))}</tbody></table></div>
          )}
          <p className="sub" style={{ margin: '10px 0 0' }}>* Peran istimewa: perubahan menunggu persetujuan Admin Sistem lain.</p>
        </section>

        <form className="kartu tumpuk" onSubmit={tambah} aria-labelledby="h-baru">
          <h2 id="h-baru">Tambah pengguna</h2>
          <label>Nama<input value={f.nama} onChange={set('nama')} required maxLength={150} /></label>
          <label>Email<input type="email" value={f.email} onChange={set('email')} required maxLength={200} autoComplete="off" /></label>
          <label>Peran
            <select value={f.peran} onChange={set('peran')}>
              {d?.peran.map((x) => <option key={x.id} value={x.id}>{x.label}{x.istimewa ? ' *' : ''}</option>)}
            </select>
          </label>
          {perluDivisi && (
            <label>Divisi<small>PIC hanya melihat kontrak divisinya.</small>
              <select value={f.divisi_id} onChange={set('divisi_id')} required>
                <option value="">Pilih divisi…</option>
                {master.data?.divisi.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
              </select>
            </label>
          )}
          <div><button className="btn utama" disabled={proses}><Ikon n="tambah" />Buat akun</button></div>
        </form>
      </div>
    </>
  );
}
