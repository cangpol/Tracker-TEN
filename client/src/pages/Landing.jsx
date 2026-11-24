import { useEffect, useState } from 'react';
import { get, kirim } from '../api.js';
import { Ikon, Logo } from '../ui.jsx';

const gulir = (id) => {
  const hemat = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: hemat ? 'auto' : 'smooth', block: 'start' });
};

const MASALAH = [
  ['jam', 'Masa berlaku terlewat', 'Kerja sama berakhir tanpa disadari, atau batas pemberitahuan lewat sehingga kontrak terperpanjang sendiri.', 'Sisa hari dan batas notice dihitung otomatis, lengkap dengan pengingat bertingkat.'],
  ['dokumen', 'Dokumen tak jelas di mana', 'Draf, versi final bertanda tangan, dan adendum tersebar di banyak folder dan chat.', 'Tautan dokumen berversi per kategori. Dibuka lewat aplikasi dan tercatat.'],
  ['ulang', 'Status tidak terpantau', 'Tidak ada yang tahu kontrak sedang di meja Legal, Finance, atau Direksi.', 'Alur persetujuan berjenjang dengan riwayat lengkap dan notifikasi ke penyetuju.'],
];

const FITUR = [
  ['kalender', 'Radar masa berlaku', 'Kelompok sisa hari dari “sudah lewat” sampai “lebih dari 180 hari”. Warna selalu disertai label dan ikon.'],
  ['lonceng', 'Pengingat bertingkat', 'H-120, H-60, H-30, H-7 dari tanggal berakhir dan batas notice. Penerima naik dari PIC ke Legal lalu Direksi. Lewat lonceng dan email ringkasan harian.'],
  ['perisai', 'Persetujuan berjenjang', 'Legal, Finance, Direksi menurut nilai dan tingkat risiko. Penyetuju tidak boleh sama dengan pembuat kontrak.'],
  ['dokumen', 'Dokumen berversi', 'Draft, final bertanda tangan, adendum. Kontrak tidak bisa aktif tanpa dokumen final.'],
  ['kunci', 'Nilai kontrak terbatas', 'Nilai dan skema pembayaran hanya sampai ke Legal, Finance, dan Direksi. Peran lain tidak pernah menerimanya.'],
  ['ulang', 'Perpanjangan dan auto-renew', 'Kontrak auto-renew tidak diam-diam berakhir. Riwayat tanggal lama tetap tersimpan setiap perpanjangan.'],
  ['rumah', 'Dashboard menurut peran', 'Antrian persetujuan untuk penyetuju, kesehatan sistem untuk Admin Sistem, kontrak divisi untuk PIC.'],
  ['log', 'Audit log dan ekspor aman', 'Setiap perubahan dan pembukaan dokumen tercatat dan tidak bisa diubah. Ekspor CSV menetralkan rumus berbahaya.'],
];

const ALUR = [
  ['Draft', 'PIC atau Legal menyusun data dan menambahkan draf.'],
  ['Review Legal', 'Legal menelaah dan menentukan jalur berikutnya.'],
  ['Review Finance', 'Hanya bila kontrak bernilai.'],
  ['Persetujuan Direksi', 'Bila risiko tinggi atau nilai di atas ambang.'],
  ['Menunggu TTD', 'Menunggu penandatanganan para pihak.'],
  ['Aktif', 'Dokumen final diunggah, pemantauan masa berlaku dimulai.'],
];

const PERAN = [
  ['legal', 'Legal', 'Kelola semua kontrak, setujui tahap Legal, catat perpanjangan, atur reminder dan ambang persetujuan.'],
  ['pic', 'PIC Unit', 'Input dan ubah kontrak divisinya sendiri, ajukan ke Legal, tambah dokumen.'],
  ['finance', 'Finance', 'Tinjau kontrak bernilai, lihat nilai kontrak, setujui tahap Finance.'],
  ['direksi', 'HQ / TEN (Direksi)', 'Pantau seluruh kontrak, setujui tahap Direksi, putuskan kontrak.'],
  ['admin_sistem', 'Super Admin (Admin Sistem)', 'Kelola pengguna, peran, divisi, dan kesehatan sistem. Tidak melihat isi kontrak.'],
  ['viewer', 'Auditor (Viewer)', 'Baca saja: pantau status dan masa berlaku tanpa nilai dan dokumen.'],
];

const KEAMANAN = [
  'Hak akses diperiksa di server per peran dan per divisi, bukan hanya disembunyikan di tampilan.',
  'Kolom sensitif disaring di server sebelum dikirim. Peran tanpa hak tidak menerima datanya sama sekali.',
  'Audit log, riwayat status, dan persetujuan hanya bisa ditambah. Tidak ada jalur ubah atau hapus.',
  'Kata sandi di-hash, sandi sementara hanya tampil sekali dan wajib diganti, percobaan login dibatasi.',
  'Peran istimewa (Legal, Finance, Direksi, Admin Sistem) butuh persetujuan Admin Sistem lain.',
  'Dokumen asli tetap di Drive atau SharePoint. Aplikasi hanya menyimpan tautan https dari domain yang diizinkan.',
];

/** Cuplikan tampilan produk. Data fiktif, hanya ilustrasi. */
function Cuplikan() {
  const radar = [['merah', 1, 'Sudah lewat'], ['oranye', 3, '1–30 hari'], ['oranye', 2, '31–60 hari'], ['kuning', 4, '91–180 hari'], ['hijau', 12, '> 180 hari']];
  const baris = [['Kerja sama praktik kerja siswa', 'SMK Contoh', '12 hari', 'oranye', 'Segera perpanjang'], ['Pelatihan guru semester genap', 'Yayasan Contoh', '45 hari', 'oranye', 'Segera perpanjang'], ['Pengadaan platform belajar', 'CV Contoh', '130 hari', 'kuning', 'Perlu perhatian']];
  return (
    <figure className="lp-cuplikan" aria-label="Contoh tampilan dashboard dengan data fiktif">
      <div className="lp-cup-bar" aria-hidden="true"><i /><i /><i /></div>
      <div className="lp-cup-isi">
        <div className="lp-cup-radar" aria-hidden="true">
          {radar.map(([w, n, l]) => <div key={l} className={w}><b>{n}</b><span>{l}</span></div>)}
        </div>
        <ul className="lp-cup-daftar" aria-hidden="true">
          {baris.map(([j, p, s, w, t]) => (
            <li key={j}><div><strong>{j}</strong><small>{p}</small></div><span>{s}</span><span className={`lencana ${w}`}>{t}</span></li>
          ))}
        </ul>
      </div>
      <figcaption>Contoh tampilan · data fiktif</figcaption>
    </figure>
  );
}

export default function Landing({ fokus, onMasuk }) {
  const [demo, setDemo] = useState({ aktif: false, akun: [] });
  const [proses, setProses] = useState(null);
  const [galat, setGalat] = useState('');

  useEffect(() => { get('/demo/akun').then(setDemo).catch(() => {}); }, []);
  useEffect(() => { if (fokus === 'demo') setTimeout(() => gulir('demo'), 50); }, [fokus]);

  const masukDemo = async (id) => {
    setProses(id); setGalat('');
    try { onMasuk(await kirim('POST', '/auth/demo', { id })); location.hash = '#/'; }
    catch (e) { setGalat(e.message); setProses(null); }
  };
  const akunPeran = (peran) => demo.akun.filter((a) => a.peran === peran);

  return (
    <div className="lp">
      <a className="lompat" href="#/" onClick={(e) => { e.preventDefault(); gulir('isi-lp'); }}>Lewati ke konten</a>
      <header className="lp-nav">
        <div className="lp-nav-isi">
          <a className="lp-merek" href="#/" aria-label="Partnership TEN, beranda"><Logo tinggi={34} /><span><b>Partnership TEN</b><small>Monitoring MoU &amp; Kontrak</small></span></a>
          <nav aria-label="Bagian halaman" className="lp-tautan">
            <button onClick={() => gulir('fitur')}>Fitur</button>
            <button onClick={() => gulir('alur')}>Cara kerja</button>
            <button onClick={() => gulir('peran')}>Peran</button>
            <button onClick={() => gulir('keamanan')}>Keamanan</button>
          </nav>
          <div className="baris">
            {demo.aktif && <button className="btn lp-btn-ghost" onClick={() => gulir('demo')}>Coba demo</button>}
            <a className="btn utama lp-btn-cta" href="#/masuk">Masuk</a>
          </div>
        </div>
      </header>

      <main id="isi-lp" tabIndex={-1}>
        <section className="lp-hero" aria-labelledby="lp-h1">
          <div className="lp-hero-isi">
            <div>
              <p className="lp-eyebrow">Monitoring MoU dan kontrak kerja sama</p>
              <h1 id="lp-h1">Tidak ada kerja sama yang kedaluwarsa tanpa Anda ketahui.</h1>
              <p className="lp-lead">Partnership TEN memantau masa berlaku, batas pemberitahuan, dan alur persetujuan setiap MoU dan kontrak PT Triputra Edukasi Nusantara, lalu mengingatkan orang yang tepat pada waktunya.</p>
              <div className="baris">
                <a className="btn utama lp-btn-cta lp-besar" href="#/masuk">Masuk ke aplikasi</a>
                {demo.aktif && <button className="btn lp-btn-ghost lp-besar" onClick={() => gulir('demo')}>Lihat demo</button>}
              </div>
              <ul className="lp-poin">
                <li><Ikon n="ok" />Radar masa berlaku</li><li><Ikon n="ok" />Pengingat bertingkat</li><li><Ikon n="ok" />Persetujuan berjenjang</li>
              </ul>
            </div>
            <Cuplikan />
          </div>
        </section>

        <section className="lp-bagian" aria-labelledby="lp-masalah">
          <div className="lp-judul"><p className="lp-eyebrow terang">Masalah yang diselesaikan</p><h2 id="lp-masalah">Dari kontrak yang tercecer menjadi satu pandangan yang jelas</h2></div>
          <div className="lp-tiga">
            {MASALAH.map(([ikon, judul, masalah, solusi]) => (
              <article key={judul} className="kartu lp-kartu">
                <span className="lp-ikon"><Ikon n={ikon} /></span>
                <h3>{judul}</h3>
                <p className="lp-masalah">{masalah}</p>
                <p className="lp-solusi"><Ikon n="ok" /> {solusi}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-bagian lp-abu" id="fitur" aria-labelledby="lp-fitur">
          <div className="lp-judul"><p className="lp-eyebrow terang">Fitur</p><h2 id="lp-fitur">Lengkap untuk memantau, ringkas untuk dipahami</h2></div>
          <div className="lp-empat">
            {FITUR.map(([ikon, judul, isi]) => (
              <article key={judul} className="kartu lp-kartu kecil">
                <span className="lp-ikon"><Ikon n={ikon} /></span>
                <h3>{judul}</h3><p>{isi}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-bagian" id="alur" aria-labelledby="lp-alur">
          <div className="lp-judul"><p className="lp-eyebrow terang">Cara kerja</p><h2 id="lp-alur">Satu alur dari draft sampai aktif</h2>
            <p>Tahap Finance dan Direksi hanya dilalui bila perlu, ditentukan otomatis dari nilai dan tingkat risiko kontrak.</p></div>
          <ol className="lp-alur">
            {ALUR.map(([judul, isi], i) => (<li key={judul}><span className="lp-no">{i + 1}</span><strong>{judul}</strong><small>{isi}</small></li>))}
          </ol>
          <p className="lp-catatan"><Ikon n="ulang" /> Setelah aktif: sistem menghitung sisa hari, mengingatkan penanggung jawab, lalu perpanjangan dicatat dengan riwayat lengkap.</p>
        </section>

        <section className="lp-bagian lp-abu" id="peran" aria-labelledby="lp-peran">
          <div className="lp-judul"><p className="lp-eyebrow terang">Untuk setiap peran</p><h2 id="lp-peran">Setiap orang melihat apa yang perlu dan berhak ia lihat</h2></div>
          <div className="lp-tiga">
            {PERAN.map(([peran, nama, isi]) => (
              <article key={peran} className="kartu lp-kartu kecil"><h3>{nama}</h3><p>{isi}</p></article>
            ))}
          </div>
        </section>

        {demo.aktif && (
          <section className="lp-bagian lp-demo" id="demo" aria-labelledby="lp-demo">
            <div className="lp-judul"><p className="lp-eyebrow">Coba langsung</p><h2 id="lp-demo">Masuk dengan satu klik sebagai…</h2>
              <p>Pilih peran untuk melihat bagaimana aplikasi tampil dan apa yang boleh dilakukan. Semua data adalah contoh fiktif, dan perubahan dapat terlihat oleh pengunjung demo lain.</p></div>
            {galat && <p className="galat" role="alert" style={{ marginBottom: 14 }}>{galat}</p>}
            <div className="lp-demo-grid">
              {demo.akun.map((a) => (
                <button key={a.id} className="lp-demo-kartu" onClick={() => masukDemo(a.id)} disabled={proses !== null}
                  aria-label={`Masuk sebagai ${a.nama}, peran ${a.peran_label}`}>
                  <span className="lp-demo-peran">{a.peran_label}</span>
                  <strong>{a.nama}</strong>
                  <span className="lp-demo-ringkas">{a.ringkas}</span>
                  <span className="lp-demo-aksi">{proses === a.id ? 'Masuk…' : 'Masuk sebagai peran ini'} <Ikon n="keluar" /></span>
                </button>
              ))}
            </div>
            <p className="lp-catatan" style={{ color: '#cdd7ff' }}>Tip: coba Legal untuk mengatur segalanya, PIC untuk melihat pembatasan divisi, dan Auditor untuk melihat mode baca saja.</p>
          </section>
        )}

        <section className="lp-bagian" id="keamanan" aria-labelledby="lp-aman">
          <div className="lp-judul"><p className="lp-eyebrow terang">Keamanan dan kepatuhan</p><h2 id="lp-aman">Dirancang agar data kontrak tetap terkendali</h2></div>
          <ul className="lp-aman">
            {KEAMANAN.map((t) => <li key={t}><Ikon n="perisai" /><span>{t}</span></li>)}
          </ul>
        </section>

        <section className="lp-penutup" aria-labelledby="lp-tutup">
          <h2 id="lp-tutup">Siap memantau kerja sama Anda?</h2>
          <p>Masuk dengan akun yang diberikan Admin Sistem.</p>
          <div className="baris" style={{ justifyContent: 'center' }}>
            <a className="btn utama lp-btn-cta lp-besar" href="#/masuk">Masuk ke aplikasi</a>
            {demo.aktif && <button className="btn lp-btn-ghost lp-besar" onClick={() => gulir('demo')}>Coba demo</button>}
          </div>
        </section>
      </main>

      <footer className="lp-kaki">
        <div className="lp-kaki-isi">
          <span className="lp-merek"><Logo tinggi={28} /><span><b>Partnership TEN</b></span></span>
          <small>© {new Date().getFullYear()} PT Triputra Edukasi Nusantara. Cuplikan layar dan akun demo memakai data fiktif.</small>
        </div>
      </footer>
    </div>
  );
}
