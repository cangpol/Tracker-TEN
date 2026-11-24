import { get } from '../api.js';
import { Ikon, Status, useData, waktu } from '../ui.jsx';
import { LABEL_AKSI } from './Audit.jsx';

const lama = (d) => (d > 86400 ? `${Math.floor(d / 86400)} hari` : d > 3600 ? `${Math.floor(d / 3600)} jam` : `${Math.max(1, Math.floor(d / 60))} menit`);

function Kartu({ n, l, href, peringatan }) {
  return (
    <a className={`kartu angka${peringatan && n > 0 ? ' peringatan' : ''}`} href={href}>
      <span className="n">{n}</span><span className="l">{l}</span>
    </a>
  );
}

export default function AdminDashboard() {
  const s = useData(() => get('/admin/ringkasan'), []);
  const d = s.data;
  const maks = d ? Math.max(1, ...d.pengguna.per_peran.map((p) => p.jumlah)) : 1;
  const perlu = d ? d.permintaan_peran_menunggu + d.pengguna.belum_ganti_sandi + d.keamanan_24_jam.login_gagal : 0;

  return (
    <>
      <Status s={s} />
      {d && (
        <>
          <section className="hero" aria-labelledby="h-hero">
            <div>
              <h1 id="h-hero">{d.permintaan_peran_menunggu ? `${d.permintaan_peran_menunggu} permintaan peran menunggu persetujuan Anda` : perlu ? 'Ada hal keamanan yang perlu dicek' : 'Sistem berjalan normal'}</h1>
              <p>Dashboard Admin Sistem menampilkan pengguna dan kesehatan sistem. Isi dan nilai kontrak sengaja tidak ditampilkan di sini.</p>
              <div className="chips">
                <a className="chip" href="#/pengguna"><b>{d.permintaan_peran_menunggu}</b><span>Persetujuan peran</span></a>
                <a className="chip" href="#/audit"><b>{d.keamanan_24_jam.login_gagal}</b><span>Login gagal (24 jam)</span></a>
                <a className="chip" href="#/pengguna"><b>{d.pengguna.belum_ganti_sandi}</b><span>Belum ganti sandi</span></a>
              </div>
            </div>
            <a className="btn utama" href="#/pengguna"><Ikon n="pengguna" />Kelola pengguna</a>
          </section>

          <div className="grid-kartu">
            <Kartu n={d.pengguna.aktif} l="Pengguna aktif" href="#/pengguna" />
            <Kartu n={d.pengguna.nonaktif} l="Pengguna nonaktif" href="#/pengguna" />
            <Kartu n={d.pengguna.belum_pernah_login} l="Belum pernah login" href="#/pengguna" />
            <Kartu n={d.keamanan_24_jam.login_berhasil} l="Login berhasil (24 jam)" href="#/audit" />
            <Kartu n={d.keamanan_24_jam.akses_ditolak} l="Akses ditolak (24 jam)" href="#/audit" peringatan />
          </div>

          <section className="kartu" style={{ marginBottom: 20 }} aria-labelledby="h-unit">
            <h2 id="h-unit">Akun PIC per unit</h2>
            <p style={{ margin: '0 0 12px', color: 'var(--muted)' }}>Unit tanpa PIC aktif tidak punya penerima notifikasi dan tidak bisa mengajukan kontrak sendiri.</p>
            <div className="grid-3">
              {d.per_unit.map((u) => (
                <div key={u.id} className="kartu angka" style={u.pic_aktif === 0 ? { borderColor: 'var(--oranye-fg)' } : undefined}>
                  <span className="n">{u.pic_aktif}</span>
                  <span className="l">{u.nama}</span>
                  {u.pic_aktif === 0 && <span className="lencana oranye"><Ikon n="waspada" />Belum ada PIC aktif</span>}
                </div>
              ))}
            </div>
            <p style={{ margin: '12px 0 0' }}><a href="#/pengguna">Kelola akun PIC →</a></p>
          </section>

          <div className="tiga">
            <section className="kartu" aria-labelledby="h-peran">
              <h2 id="h-peran">Pengguna aktif per peran</h2>
              <ul className="dist">
                {d.pengguna.per_peran.map((p) => (
                  <li key={p.peran}><span>{p.label}</span><strong>{p.jumlah}</strong>
                    <div className="rel" aria-hidden="true"><span style={{ width: `${(p.jumlah / maks) * 100}%` }} /></div></li>
                ))}
              </ul>
            </section>
            <section className="kartu" aria-labelledby="h-sistem">
              <h2 id="h-sistem">Kesehatan sistem</h2>
              <dl className="info" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div><dt>Job harian terakhir</dt><dd>{d.sistem.job_terakhir ? waktu(d.sistem.job_terakhir) : 'Belum berjalan'}</dd></div>
                <div><dt>Waktu server</dt><dd>{waktu(d.sistem.waktu_server)}</dd></div>
                <div><dt>Server menyala</dt><dd>{lama(d.sistem.uptime_detik)}</dd></div>
                <div><dt>Zona bisnis</dt><dd>{d.sistem.zona_bisnis}</dd></div>
                <div><dt>Database</dt><dd>{d.sistem.database}</dd></div>
                <div><dt>Pengingat dalam aplikasi (24 jam)</dt><dd>{d.notifikasi_24_jam.dalam_aplikasi}</dd></div>
                <div><dt>Email (24 jam)</dt><dd>{d.notifikasi_24_jam.email_aktif ? `${d.notifikasi_24_jam.email_terkirim} terkirim, ${d.notifikasi_24_jam.email_gagal} gagal` : 'Belum dikonfigurasi'}</dd></div>
                <div><dt>Entri audit log</dt><dd>{d.sistem.jumlah_audit_log}</dd></div>
              </dl>
            </section>
            <section className="kartu" aria-labelledby="h-peristiwa">
              <h2 id="h-peristiwa">Peristiwa keamanan terbaru</h2>
              {d.peristiwa.length === 0 ? <p className="kosong">Belum ada peristiwa.</p> : (
                <ol className="garis">
                  {d.peristiwa.map((e) => (
                    <li key={e.id}><strong>{LABEL_AKSI[e.aksi] ?? e.aksi}</strong>
                      <div className="sub">{waktu(e.waktu)} · {e.pelaku_nama || 'Anonim'}</div></li>
                  ))}
                </ol>
              )}
              <p style={{ margin: '12px 0 0' }}><a href="#/audit">Lihat semua audit log →</a></p>
            </section>
          </div>
        </>
      )}
    </>
  );
}
