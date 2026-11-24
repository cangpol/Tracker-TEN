import { useCallback, useEffect, useState } from 'react';
import { get, kirim } from './api.js';
import { Ikon, Logo, SayaCtx, bisa, useHash } from './ui.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Daftar from './pages/Daftar.jsx';
import Detail from './pages/Detail.jsx';
import Form from './pages/Form.jsx';
import Pengguna from './pages/Pengguna.jsx';
import Audit from './pages/Audit.jsx';
import Akun from './pages/Akun.jsx';
import Notifikasi from './pages/Notifikasi.jsx';
import Pengaturan from './pages/Pengaturan.jsx';

const TanpaAkses = () => (
  <div className="kartu kosong" role="alert">
    <h1 style={{ fontSize: '1.2rem' }}>Anda tidak memiliki akses ke halaman ini</h1>
    <p>Hubungi Admin Sistem bila Anda merasa seharusnya memiliki akses.</p>
    <a className="btn" href="#/">Kembali ke dashboard</a>
  </div>
);

export default function App() {
  const [saya, setSaya] = useState(undefined); // undefined = belum dicek, null = belum login
  const [belumDibaca, setBelumDibaca] = useState(0);
  const rute = useHash();
  const bagian = rute.split('?')[0].split('/').filter(Boolean);
  const [b0, b1, b2] = bagian;

  useEffect(() => { get('/auth/saya').then(setSaya).catch(() => setSaya(null)); }, []);

  const muatNotif = useCallback(() => { get('/notifikasi').then((d) => setBelumDibaca(d.belum_dibaca)).catch(() => {}); }, []);
  useEffect(() => {
    if (!saya || saya.wajib_ganti) return undefined;
    muatNotif();
    const t = setInterval(muatNotif, 60_000);
    return () => clearInterval(t);
  }, [saya, rute, muatNotif]);

  if (saya === undefined) return <p className="kosong" role="status">Memuat…</p>;
  if (!saya) return b0 === 'masuk' ? <Login onMasuk={setSaya} /> : <Landing fokus={b0} onMasuk={setSaya} />;

  const keluar = async (tujuan = '#/') => { await kirim('POST', '/auth/logout').catch(() => {}); setSaya(null); setBelumDibaca(0); location.hash = tujuan; };
  const lihatKontrak = bisa(saya, 'lihat_kontrak');
  const bisaPengaturan = bisa(saya, 'kelola_divisi') || bisa(saya, 'kelola_master_bisnis');

  let halaman;
  if (saya.wajib_ganti) halaman = <Akun paksa onSelesai={setSaya} />;
  else if (b0 === 'akun') halaman = <Akun onSelesai={setSaya} />;
  else if (b0 === 'notifikasi') halaman = <Notifikasi onBaca={muatNotif} />;
  else if (b0 === 'pengaturan') halaman = bisaPengaturan ? <Pengaturan /> : <TanpaAkses />;
  else if (b0 === 'pengguna') halaman = bisa(saya, 'kelola_pengguna') ? <Pengguna /> : <TanpaAkses />;
  else if (b0 === 'audit') halaman = bisa(saya, 'lihat_audit') ? <Audit /> : <TanpaAkses />;
  else if (b0 === 'kontrak') {
    if (!lihatKontrak) halaman = <TanpaAkses />;
    else if (b1 === 'baru') halaman = bisa(saya, 'tambah_kontrak') ? <Form key="baru" /> : <TanpaAkses />;
    else if (b1 && b2 === 'ubah') halaman = <Form key={b1} id={b1} />;
    else if (b1) halaman = <Detail key={b1} id={b1} />;
    else halaman = <Daftar rute={rute} />;
  } else halaman = bisa(saya, 'dashboard_sistem') ? <AdminDashboard /> : <Dashboard />;

  const aktif = b0 || 'dashboard';
  const Menu = ({ href, kunci, ikon, children, lencana }) => (
    <a href={href} aria-current={aktif === kunci ? 'page' : undefined}>
      <Ikon n={ikon} />{children}{lencana > 0 && <span className="nav-lencana" aria-label={`${lencana} belum dibaca`}>{lencana > 99 ? '99+' : lencana}</span>}
    </a>
  );

  return (
    <SayaCtx.Provider value={saya}>
      <div className="app">
        <a className="lompat" href="#/" onClick={(e) => { e.preventDefault(); document.getElementById('utama').focus(); }}>Lewati ke konten</a>
        <aside className="sisi">
          <Logo />
          <div className="merek"><b>Partnership TEN</b><small>Monitoring MoU &amp; Kontrak</small></div>
          {!saya.wajib_ganti && (
            <nav className="nav" aria-label="Menu utama">
              <Menu href="#/" kunci="dashboard" ikon="rumah">Dashboard</Menu>
              {lihatKontrak && <Menu href="#/kontrak" kunci="kontrak" ikon="daftar">Daftar Kontrak</Menu>}
              <Menu href="#/notifikasi" kunci="notifikasi" ikon="lonceng" lencana={belumDibaca}>Notifikasi</Menu>
              {bisa(saya, 'kelola_pengguna') && <Menu href="#/pengguna" kunci="pengguna" ikon="pengguna">Pengguna</Menu>}
              {bisaPengaturan && <Menu href="#/pengaturan" kunci="pengaturan" ikon="roda">Pengaturan</Menu>}
              {bisa(saya, 'lihat_audit') && <Menu href="#/audit" kunci="audit" ikon="log">Audit log</Menu>}
              {!saya.demo && <Menu href="#/akun" kunci="akun" ikon="kunci">Akun saya</Menu>}
            </nav>
          )}
          <div className="bawah">
            <span><strong>{saya.nama}</strong><br /><span className="peran-label">{saya.peran_label}</span></span>
            <button className="btn kecil" onClick={() => keluar()}><Ikon n="keluar" />Keluar</button>
          </div>
        </aside>
        <main className="isi" id="utama" tabIndex={-1}>
          {saya.demo && (
            <div className="banner-demo" role="status">
              <span><strong>Mode demo.</strong> Anda masuk sebagai {saya.peran_label}. Data fiktif dan dipakai bersama pengunjung lain.</span>
              <button className="btn kecil" onClick={() => keluar('#/demo')}>Ganti peran</button>
            </div>
          )}
          {halaman}
        </main>
      </div>
    </SayaCtx.Provider>
  );
}
