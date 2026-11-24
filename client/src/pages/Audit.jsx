import { useState } from 'react';
import { get } from '../api.js';
import { Status, useData, waktu } from '../ui.jsx';

export const LABEL_AKSI = {
  login: 'Login berhasil', login_gagal: 'Login gagal', logout: 'Keluar', akses_ditolak: 'Akses ditolak', transisi_dilarang: 'Perubahan status dilarang',
  sandi_diganti: 'Kata sandi diganti', sandi_gagal_ganti: 'Gagal ganti sandi', sandi_direset: 'Sandi direset',
  pengguna_dibuat: 'Pengguna dibuat', pengguna_diubah: 'Pengguna diubah', pengguna_dinonaktifkan: 'Pengguna dinonaktifkan', pengguna_diaktifkan: 'Pengguna diaktifkan',
  peran_diminta: 'Peran diminta', peran_disetujui: 'Peran disetujui', peran_ditolak: 'Peran ditolak',
  kontrak_dibuat: 'Kontrak dibuat', kontrak_diubah: 'Kontrak diubah', transisi_status: 'Status diubah', transisi_ditolak: 'Perubahan status ditolak',
  perpanjangan: 'Perpanjangan dicatat', job_berakhir: 'Berakhir otomatis', login_demo: 'Login demo',
  dokumen_ditambah: 'Dokumen ditambah', dokumen_dibuka: 'Dokumen dibuka', dokumen_diarsipkan: 'Dokumen diarsipkan', ekspor: 'Ekspor data',
  pengaturan_diubah: 'Pengaturan diubah', aturan_reminder_dibuat: 'Aturan reminder dibuat', aturan_reminder_diubah: 'Aturan reminder diubah',
  divisi_dibuat: 'Divisi dibuat', divisi_diubah: 'Divisi diubah',
};

export default function Audit() {
  const [aksi, setAksi] = useState('');
  const [halaman, setHalaman] = useState(1);
  const s = useData(() => get(`/audit-log?${new URLSearchParams({ aksi, halaman })}`), [aksi, halaman]);
  const d = s.data;
  const maks = d ? Math.max(1, Math.ceil(d.total / d.per_halaman)) : 1;

  return (
    <>
      <div className="kepala"><div><h1>Audit log</h1><p>{d ? `${d.total} catatan. Catatan tidak dapat diubah atau dihapus.` : ' '}</p></div></div>
      <div className="filter" style={{ gridTemplateColumns: 'minmax(220px, 320px)' }}>
        <label>Jenis aksi
          <select value={aksi} onChange={(e) => { setAksi(e.target.value); setHalaman(1); }}>
            <option value="">Semua</option>
            {d?.aksi.map((a) => <option key={a} value={a}>{LABEL_AKSI[a] ?? a}</option>)}
          </select>
        </label>
      </div>
      <div className="kartu">
        <Status s={s} />
        {d && (d.data.length === 0 ? <p className="kosong">Tidak ada catatan untuk filter ini.</p> : (
          <div className="tabel-bungkus">
            <table>
              <thead><tr><th>Waktu</th><th>Aksi</th><th>Pelaku</th><th>Objek</th><th>Keterangan</th><th>IP</th></tr></thead>
              <tbody>
                {d.data.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{waktu(e.waktu)}</td>
                    <td><span className={`lencana ${/gagal|ditolak|dilarang/.test(e.aksi) ? 'oranye' : 'netral'}`}>{LABEL_AKSI[e.aksi] ?? e.aksi}</span></td>
                    <td>{e.pelaku_nama || <span className="sub">Sistem / anonim</span>}</td>
                    <td>{e.objek_tabel ? `${e.objek_tabel} #${e.objek_id ?? '—'}` : '—'}</td>
                    <td>{e.ringkasan || '—'}</td>
                    <td className="sub">{e.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {d && d.total > d.per_halaman && (
          <div className="baris" style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <button className="btn kecil" disabled={halaman <= 1} onClick={() => setHalaman(halaman - 1)}>Sebelumnya</button>
            <span>Halaman {halaman} dari {maks}</span>
            <button className="btn kecil" disabled={halaman >= maks} onClick={() => setHalaman(halaman + 1)}>Berikutnya</button>
          </div>
        )}
      </div>
    </>
  );
}
