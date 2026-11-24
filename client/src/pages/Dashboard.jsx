import { get } from '../api.js';
import { Ikon, Tingkat, Tanda, Status, useData, tanggal, sisaTeks, STATUS_LABEL } from '../ui.jsx';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function Kartu({ n, l, href, peringatan }) {
  return (
    <a className={`kartu angka${peringatan && n > 0 ? ' peringatan' : ''}`} href={href}>
      <span className="n">{n}</span><span className="l">{l}</span>
    </a>
  );
}

export default function Dashboard() {
  const s = useData(() => get('/dashboard'), []);
  const d = s.data;
  const radarJumlah = (id) => d?.radar.find((r) => r.id === id)?.jumlah ?? 0;
  const segera = d ? radarJumlah('lewat') + radarJumlah('30') : 0;

  return (
    <>
      <Status s={s} />
      {d && (
        <>
          <section className="hero" aria-labelledby="h-hero">
            <div>
              <h1 id="h-hero">
                {segera + d.kartu.notice_terlewat + d.kartu.perlu_konfirmasi_auto_renew === 0
                  ? 'Semua kerja sama terpantau aman'
                  : `${segera} kontrak berakhir dalam 30 hari atau sudah lewat`}
              </h1>
              <p>Urus yang paling mendesak lebih dulu. Klik angka untuk melihat daftarnya.</p>
              <div className="chips">
                <a className="chip" href="#/kontrak?rentang=30"><b>{radarJumlah('30')}</b><span>Berakhir ≤ 30 hari</span></a>
                <a className="chip" href="#/kontrak?perlu=notice"><b>{d.kartu.notice_terlewat}</b><span>Notice terlewat</span></a>
                <a className="chip" href="#/kontrak?perlu=auto_renew"><b>{d.kartu.perlu_konfirmasi_auto_renew}</b><span>Konfirmasi auto-renew</span></a>
              </div>
            </div>
            <a className="btn utama" href="#/kontrak/baru"><Ikon n="tambah" />Tambah kontrak</a>
          </section>

          <div className="grid-kartu">
            <Kartu n={d.kartu.total} l="Total kontrak" href="#/kontrak" />
            <Kartu n={d.kartu.aktif} l="Aktif" href="#/kontrak?status=aktif" />
            <Kartu n={d.kartu.segera_berakhir} l="Segera berakhir (≤ 90 hari)" href="#/kontrak?tingkat=oranye" peringatan />
            <Kartu n={d.kartu.berakhir} l="Berakhir" href="#/kontrak?status=berakhir" />
            <Kartu n={d.kartu.dalam_proses} l="Dalam proses persetujuan" href="#/kontrak?status=draft" />
          </div>

          <section className="kartu" style={{ marginBottom: 20 }} aria-labelledby="h-radar">
            <h2 id="h-radar">Radar masa berlaku</h2>
            <p style={{ margin: '0 0 12px', color: 'var(--muted)' }}>Kontrak aktif dikelompokkan menurut sisa hari. Klik untuk memfilter.</p>
            <div className="radar">
              {d.radar.map((r) => (
                <a key={r.id} className={r.tingkat} href={`#/kontrak?rentang=${r.id}`}>
                  <span className="n">{r.jumlah}</span>
                  <span className="l">{r.label}</span>
                  <span className="tb" aria-hidden="true"><span style={{ width: `${(r.jumlah / Math.max(1, d.radar.reduce((a, x) => a + x.jumlah, 0))) * 100}%` }} /></span>
                </a>
              ))}
            </div>
          </section>

          <section className="kartu" style={{ marginBottom: 20 }} aria-labelledby="h-prioritas">
            <h2 id="h-prioritas">Prioritas: paling dekat berakhir</h2>
            {d.prioritas.length === 0 ? (
              <p className="kosong">Tidak ada kontrak yang perlu tindakan segera.</p>
            ) : (
              <div className="tabel-bungkus">
                <table>
                  <thead><tr><th>Kontrak</th><th>PIC</th><th>Berakhir</th><th>Sisa</th><th>Tingkat</th><th><span className="sr">Aksi</span></th></tr></thead>
                  <tbody>
                    {d.prioritas.map((k) => (
                      <tr key={k.id}>
                        <td>
                          <a className="judul" href={`#/kontrak/${k.id}`}>{k.judul}</a>
                          <div className="sub">{k.counterparty_nama}</div>
                          <Tanda k={k} />
                        </td>
                        <td>{k.pic_nama}<div className="sub">{k.divisi_nama}</div></td>
                        <td>{tanggal(k.tanggal_berakhir)}<div className="sub">Notice: {k.masa_pemberitahuan_hari ? tanggal(k.tanggal_batas_notice) : '—'}</div></td>
                        <td><strong>{sisaTeks(k.sisa_hari)}</strong></td>
                        <td><Tingkat tingkat={k.tingkat} /></td>
                        <td>
                          <div className="baris">
                            {k.tautan_dokumen_final && (
                              <a className="btn kecil" href={k.tautan_dokumen_final} target="_blank" rel="noopener noreferrer"><Ikon n="luar" />Buka dokumen</a>
                            )}
                            <a className="btn kecil utama" href={`#/kontrak/${k.id}`}>Ajukan perpanjangan</a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="kartu" style={{ marginBottom: 20 }} aria-labelledby="h-bulan">
            <h2 id="h-bulan">Kontrak berakhir per bulan (12 bulan ke depan)</h2>
            <Batang data={d.berakhir_per_bulan} />
          </section>

          <div className="tiga">
            <Distribusi id="h-status" judul="Komposisi status" baris={d.per_status.map((x) => [STATUS_LABEL[x.status] ?? x.status, x.jumlah])} />
            <Distribusi id="h-divisi" judul="Kontrak aktif per divisi" baris={d.per_divisi.map((x) => [x.divisi, x.jumlah])} />
            <Distribusi id="h-risiko" judul="Kontrak aktif per tingkat risiko" baris={d.per_risiko.map((x) => [x.risiko[0].toUpperCase() + x.risiko.slice(1), x.jumlah])} />
          </div>
        </>
      )}
    </>
  );
}

function Distribusi({ id, judul, baris }) {
  const maks = Math.max(1, ...baris.map((b) => b[1]));
  return (
    <section className="kartu" aria-labelledby={id}>
      <h2 id={id}>{judul}</h2>
      {baris.length === 0 ? <p className="kosong">Belum ada data.</p> : (
        <ul className="dist">
          {baris.map(([nama, n]) => (
            <li key={nama}>
              <span>{nama}</span><strong>{n}</strong>
              <div className="rel" aria-hidden="true"><span style={{ width: `${(n / maks) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Batang({ data }) {
  const maks = Math.max(1, ...data.map((b) => b.jumlah));
  return (
    <div className="batang" role="img" aria-label={data.map((b) => `${BULAN[+b.bulan.slice(5) - 1]} ${b.bulan.slice(0, 4)}: ${b.jumlah}`).join(', ')}>
      {data.map((b) => (
        <div key={b.bulan} aria-hidden="true">
          <div className="t" style={{ height: `${(b.jumlah / maks) * 100}%`, visibility: b.jumlah ? 'visible' : 'hidden' }} />
          <b>{b.jumlah}</b>
          <span>{BULAN[+b.bulan.slice(5) - 1]}</span>
        </div>
      ))}
    </div>
  );
}
