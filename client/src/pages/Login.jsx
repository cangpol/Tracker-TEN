import { useEffect, useState } from 'react';
import { get, kirim } from '../api.js';
import { Ikon, Logo } from '../ui.jsx';

export default function Login({ onMasuk }) {
  const [email, setEmail] = useState('');
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState('');
  const [proses, setProses] = useState(false);
  const [demo, setDemo] = useState(false);
  useEffect(() => { get('/demo/akun').then((d) => setDemo(d.aktif)).catch(() => {}); }, []);

  const kirimForm = async (e) => {
    e.preventDefault();
    setProses(true); setGalat('');
    try { onMasuk(await kirim('POST', '/auth/login', { email, sandi })); location.hash = '#/'; }
    catch (err) { setGalat(err.message); setProses(false); }
  };

  return (
    <div className="masuk">
      <section className="panel" aria-label="Tentang aplikasi">
        <a href="#/" aria-label="Kembali ke beranda"><Logo tinggi={54} /></a>
        <div>
          <h1>Partnership TEN</h1>
          <p>Pantau setiap MoU dan kontrak kerja sama dalam satu tempat, dari draft sampai perpanjangan.</p>
          <ul>
            <li><Ikon n="kalender" />Pengingat masa berlaku dan batas notice</li>
            <li><Ikon n="ulang" />Alur persetujuan dan perpanjangan tercatat</li>
            <li><Ikon n="perisai" />Akses terkendali dan jejak audit</li>
          </ul>
        </div>
        <small style={{ color: '#9fb0e6' }}>PT Triputra Edukasi Nusantara</small>
      </section>
      <div className="form-sisi">
        <form onSubmit={kirimForm}>
          <a href="#/" className="kembali">← Kembali ke beranda</a>
          <div><h2 style={{ fontSize: '1.4rem' }}>Masuk</h2><p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>Gunakan akun yang diberikan Admin Sistem.</p></div>
          {galat && <p className="galat" role="alert">{galat}</p>}
          <label>Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" autoFocus />
          </label>
          <label>Kata sandi
            <input type="password" value={sandi} onChange={(e) => setSandi(e.target.value)} required autoComplete="current-password" />
          </label>
          <button className="btn utama" disabled={proses}>{proses ? 'Memeriksa…' : 'Masuk'}</button>
          {demo && <p className="sub" style={{ margin: 0, textAlign: 'center' }}>Hanya melihat-lihat? <a href="#/demo">Coba akun demo</a></p>}
        </form>
      </div>
    </div>
  );
}
