import { useState } from 'react';
import { get, kirim } from '../api.js';
import { Ikon, Status, useData, waktu } from '../ui.jsx';

const JENIS = {
  reminder_berakhir: ['oranye', 'jam', 'Masa berlaku'],
  reminder_notice: ['merah', 'waspada', 'Batas notice'],
  alur_kerja: ['aksen', 'pesawat', 'Alur kerja'],
};

export default function Notifikasi({ onBaca }) {
  const s = useData(() => get('/notifikasi'), []);
  const [galat, setGalat] = useState('');
  const d = s.data;

  const buka = async (n) => {
    try {
      if (!n.dibaca_pada) { await kirim('POST', `/notifikasi/${n.id}/baca`); onBaca?.(); }
      if (n.kontrak_id) location.hash = `#/kontrak/${n.kontrak_id}`; else s.muatUlang();
    } catch (e) { setGalat(e.message); }
  };
  const semua = async () => {
    try { await kirim('POST', '/notifikasi/baca-semua'); onBaca?.(); s.muatUlang(); } catch (e) { setGalat(e.message); }
  };

  return (
    <>
      <div className="kepala">
        <div><h1>Notifikasi</h1><p>{d ? (d.belum_dibaca ? `${d.belum_dibaca} belum dibaca` : 'Semua sudah dibaca') : ' '}</p></div>
        {d?.belum_dibaca > 0 && <button className="btn" onClick={semua}>Tandai semua dibaca</button>}
      </div>
      <Status s={s} />
      {galat && <p className="galat" role="alert" style={{ marginBottom: 12 }}>{galat}</p>}
      {d && (d.data.length === 0 ? (
        <div className="kartu kosong"><Ikon n="lonceng" /> Belum ada notifikasi. Pengingat masa berlaku dan permintaan persetujuan akan muncul di sini.</div>
      ) : (
        <ul className="notif">
          {d.data.map((n) => {
            const [warna, ikon, label] = JENIS[n.jenis] ?? ['netral', 'lonceng', 'Info'];
            return (
              <li key={n.id}>
                <button className={`kartu notif-item${n.dibaca_pada ? ' dibaca' : ''}`} onClick={() => buka(n)}>
                  <span className={`lencana ${warna}`}><Ikon n={ikon} />{label}</span>
                  <span className="notif-pesan">{n.pesan}</span>
                  <span className="sub">{waktu(n.dibuat_pada)}{n.dibaca_pada ? '' : ' · baru'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ))}
    </>
  );
}
