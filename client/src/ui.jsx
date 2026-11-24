import { useEffect, useState } from 'react';

const IKON = {
  ok: 'M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  waspada: 'M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  jam: 'M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  tutup: 'M10 14l4-4m0 4l-4-4m11 2a9 9 0 11-18 0 9 9 0 0118 0z',
  tambah: 'M12 5v14M5 12h14',
  cari: 'M21 21l-4.3-4.3M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
  keluar: 'M15 17l5-5-5-5M20 12H9m4 8H5a2 2 0 01-2-2V6a2 2 0 012-2h8',
  dokumen: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5M9 13h6M9 17h6',
  luar: 'M14 4h6v6m0-6L10 14M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  rumah: 'M3 11l9-8 9 8M5 10v10h14V10',
  daftar: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  kalender: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  perisai: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3zM9 12l2 2 4-4',
  ulang: 'M4 4v6h6M20 20v-6h-6M20 10A8 8 0 006 6.3L4 10m16 4l-2 3.7A8 8 0 014 14',
};

export const Ikon = ({ n }) => (
  <svg className="ikon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={IKON[n]} />
  </svg>
);

export const Logo = ({ tinggi }) => (
  <span className="logo-chip"><img src="/logo-ten.jpg" alt="TEN" style={tinggi ? { height: tinggi } : undefined} /></span>
);

export const STATUS_LABEL = {
  draft: 'Draft', review_legal: 'Review Legal', review_finance: 'Review Finance', persetujuan_direksi: 'Persetujuan Direksi',
  menunggu_ttd: 'Menunggu TTD', aktif: 'Aktif', negosiasi_perpanjangan: 'Negosiasi Perpanjangan',
  berakhir: 'Berakhir', diputus: 'Diputus', dibatalkan: 'Dibatalkan', arsip: 'Arsip',
};

const TINGKAT = {
  hijau: ['hijau', 'ok', 'Aman'],
  kuning: ['kuning', 'jam', 'Perlu perhatian'],
  oranye: ['oranye', 'waspada', 'Segera perpanjang'],
  merah: ['merah', 'tutup', 'Berakhir'],
};

/** Warna selalu disertai ikon dan teks (aksesibilitas). */
export function Tingkat({ tingkat }) {
  if (!tingkat) return <span className="lencana netral">—</span>;
  const [kelas, ikon, label] = TINGKAT[tingkat];
  return <span className={`lencana ${kelas}`}><Ikon n={ikon} />{label}</span>;
}

export const StatusLencana = ({ status }) => <span className="lencana netral">{STATUS_LABEL[status] ?? status}</span>;

export function Tanda({ k }) {
  return (
    <div className="tanda">
      {k.perlu_konfirmasi_auto_renew && <span className="lencana merah"><Ikon n="ulang" />Konfirmasi auto-renew</span>}
      {k.notice_terlewat && <span className="lencana oranye"><Ikon n="waspada" />Batas notice lewat</span>}
      {k.perpanjangan_otomatis && !k.perlu_konfirmasi_auto_renew ? <span className="lencana netral"><Ikon n="ulang" />Auto-renew</span> : null}
    </div>
  );
}

const FMT = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const tanggal = (t) => (t ? FMT.format(new Date(`${t.slice(0, 10)}T00:00:00Z`)) : '—');
export const waktu = (t) => new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
export const sisaTeks = (n) => (n === null || n === undefined ? '—' : n < 0 ? `Lewat ${-n} hari` : n === 0 ? 'Hari ini' : `${n} hari`);

/** Muat data dengan status memuat/galat. */
export function useData(ambil, deps) {
  const [s, setS] = useState({ memuat: true, galat: null, data: null });
  const [n, setN] = useState(0);
  useEffect(() => {
    let batal = false;
    setS((x) => ({ ...x, memuat: true, galat: null }));
    ambil().then((data) => !batal && setS({ memuat: false, galat: null, data }))
      .catch((e) => !batal && setS({ memuat: false, galat: e, data: null }));
    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...s, muatUlang: () => setN((x) => x + 1) };
}

export function Status({ s }) {
  if (s.memuat) return <p className="kosong" role="status">Memuat…</p>;
  if (s.galat) return <p className="galat" role="alert">{s.galat.message}</p>;
  return null;
}

export function useHash() {
  const [h, setH] = useState(location.hash || '#/');
  useEffect(() => {
    const f = () => setH(location.hash || '#/');
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return h.replace(/^#/, '');
}
