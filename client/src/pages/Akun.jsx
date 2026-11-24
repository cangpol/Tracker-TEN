import { useState } from 'react';
import { kirim } from '../api.js';
import { useSaya } from '../ui.jsx';

export default function Akun({ paksa, onSelesai }) {
  const saya = useSaya();
  const [f, setF] = useState({ lama: '', baru: '', ulang: '' });
  const [galat, setGalat] = useState('');
  const [ok, setOk] = useState(false);
  const [proses, setProses] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const simpan = async (e) => {
    e.preventDefault();
    setGalat(''); setOk(false);
    if (f.baru !== f.ulang) return setGalat('Konfirmasi kata sandi baru tidak sama.');
    setProses(true);
    try { onSelesai(await kirim('POST', '/auth/ganti-sandi', { lama: f.lama, baru: f.baru })); setF({ lama: '', baru: '', ulang: '' }); setOk(true); if (paksa) location.hash = '#/'; }
    catch (err) { setGalat(err.message); } finally { setProses(false); }
  };

  return (
    <>
      <div className="kepala"><div><h1>{paksa ? 'Buat kata sandi baru' : 'Akun saya'}</h1>
        <p>{paksa ? 'Kata sandi sementara harus diganti sebelum Anda bisa memakai aplikasi.' : 'Kelola kata sandi akun Anda.'}</p></div></div>
      <div className="dua">
        <form className="kartu tumpuk" onSubmit={simpan}>
          <h2>Ganti kata sandi</h2>
          {galat && <p className="galat" role="alert">{galat}</p>}
          {ok && <p className="lencana hijau" role="status">Kata sandi berhasil diganti.</p>}
          <label>Kata sandi saat ini<input type="password" value={f.lama} onChange={set('lama')} required autoComplete="current-password" /></label>
          <label>Kata sandi baru<small>Minimal 12 karakter. Gunakan kalimat sandi yang mudah diingat.</small>
            <input type="password" value={f.baru} onChange={set('baru')} required minLength={12} autoComplete="new-password" /></label>
          <label>Ulangi kata sandi baru<input type="password" value={f.ulang} onChange={set('ulang')} required minLength={12} autoComplete="new-password" /></label>
          <div><button className="btn utama" disabled={proses}>{proses ? 'Menyimpan…' : 'Simpan kata sandi'}</button></div>
        </form>
        <section className="kartu">
          <h2 style={{ marginBottom: 14 }}>Profil</h2>
          <dl className="info" style={{ gridTemplateColumns: '1fr' }}>
            <div><dt>Nama</dt><dd>{saya.nama}</dd></div>
            <div><dt>Email</dt><dd>{saya.email}</dd></div>
            <div><dt>Peran</dt><dd>{saya.peran_label}</dd></div>
          </dl>
        </section>
      </div>
    </>
  );
}
