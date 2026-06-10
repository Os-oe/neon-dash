// NEON DASH — freiwillige E-Mail-Liste (Making-of + Projekt-Updates)
// POST { email } → 200. Ein Blob pro Adresse (Pfad = base64url) → automatisch dedupliziert.
// Kein GET: die Liste ist nicht öffentlich abrufbar (Auslesen nur via Blob-CLI/Token).
import { put } from '@vercel/blob';

const b64e = (s) => Buffer.from(s, 'utf8').toString('base64url');

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  const email = String((req.body || {}).email || '').trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'invalid' });
  }
  await put(`emails/${b64e(email)}`, JSON.stringify({ email, ts: Date.now(), source: 'neon-dash' }), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return res.status(200).json({ ok: true });
}
