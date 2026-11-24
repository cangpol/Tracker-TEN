export class GalatApi extends Error {
  constructor(status, pesan) { super(pesan); this.status = status; }
}

export async function api(metode, path, body) {
  let r;
  try {
    r = await fetch(`/api/v1${path}`, {
      method: metode,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new GalatApi(0, 'Tidak dapat terhubung ke server. Periksa koneksi Anda.');
  }
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new GalatApi(r.status, data?.pesan || 'Terjadi kesalahan. Coba lagi.');
  return data;
}

export const get = (p) => api('GET', p);
export const kirim = (m, p, b) => api(m, p, b ?? {});
