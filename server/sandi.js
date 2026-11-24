import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

export function hashSandi(sandi) {
  const garam = randomBytes(16);
  return `${garam.toString('hex')}:${scryptSync(sandi, garam, 64).toString('hex')}`;
}

export function cocokSandi(sandi, tersimpan) {
  const [garam, hash] = String(tersimpan).split(':');
  if (!garam || !hash) return false;
  const a = scryptSync(sandi, Buffer.from(garam, 'hex'), 64);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// Hash palsu agar waktu respons sama bila email tidak ada (cegah enumerasi akun).
export const HASH_PALSU = hashSandi(randomBytes(8).toString('hex'));
