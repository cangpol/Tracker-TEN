import { useEffect, useState } from 'react';
import { get, kirim } from './api.js';
import { Ikon, Logo, useHash } from './ui.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Daftar from './pages/Daftar.jsx';
import Detail from './pages/Detail.jsx';
import Form from './pages/Form.jsx';

export default function App() {
  const [pengguna, setPengguna] = useState(undefined); // undefined = belum dicek
  const rute = useHash();

  useEffect(() => { get('/auth/saya').then(setPengguna).catch(() => setPengguna(null)); }, []);

  if (pengguna === undefined) return <p className="kosong" role="status">Memuat…</p>;
  if (!pengguna) return <Login onMasuk={setPengguna} />;

  const keluar = async () => { await kirim('POST', '/auth/logout').catch(() => {}); setPengguna(null); location.hash = '#/'; };
  const bagian = rute.split('?')[0].split('/').filter(Boolean);
  let halaman;
  if (bagian[0] === 'kontrak' && bagian[1] === 'baru') halaman = <Form key="baru" />;
  else if (bagian[0] === 'kontrak' && bagian[1] && bagian[2] === 'ubah') halaman = <Form key={bagian[1]} id={bagian[1]} />;
  else if (bagian[0] === 'kontrak' && bagian[1]) halaman = <Detail key={bagian[1]} id={bagian[1]} />;
  else if (bagian[0] === 'kontrak') halaman = <Daftar rute={rute} />;
  else halaman = <Dashboard />;
  const aktif = bagian[0] === 'kontrak' ? 'kontrak' : 'dashboard';

  return (
    <div className="app">
      <a className="lompat" href="#/" onClick={(e) => { e.preventDefault(); document.getElementById("utama").focus(); }}>Lewati ke konten</a>
      <aside className="sisi">
        <Logo />
        <div className="merek"><b>Partnership TEN</b><small>Monitoring MoU &amp; Kontrak</small></div>
        <nav className="nav" aria-label="Menu utama">
          <a href="#/" aria-current={aktif === 'dashboard' ? 'page' : undefined}><Ikon n="rumah" />Dashboard</a>
          <a href="#/kontrak" aria-current={aktif === 'kontrak' ? 'page' : undefined}><Ikon n="daftar" />Daftar Kontrak</a>
        </nav>
        <div className="bawah">
          <strong>{pengguna.nama}</strong>
          <button className="btn kecil" onClick={keluar}><Ikon n="keluar" />Keluar</button>
        </div>
      </aside>
      <main className="isi" id="utama" tabIndex={-1}>{halaman}</main>
    </div>
  );
}
