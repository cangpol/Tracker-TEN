import nodemailer from 'nodemailer';

/**
 * Pengirim email via SMTP (SMTP_URL, mis. smtps://user:sandi@smtp.contoh.id:465). Null bila belum dikonfigurasi:
 * reminder tetap masuk ke notifikasi dalam aplikasi.
 */
export function buatPengirimEmail() {
  if (!process.env.SMTP_URL) return null;
  const transport = nodemailer.createTransport(process.env.SMTP_URL);
  const dari = process.env.MAIL_FROM || 'Partnership TEN <no-reply@localhost>';
  return ({ to, subject, text, html }) => transport.sendMail({ from: dari, to, subject, text, html });
}
