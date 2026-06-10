// NEON DASH — globale Bestenliste (Vercel Function + Blob-Store)
// Race-frei: jeder Eintrag ist ein EIGENER Blob, alle Daten stecken im Pfadnamen:
//   entries/<score 7-stellig>-<name base64url>-<dist>
// Dadurch kein Read-Modify-Write (keine Lost Updates) und GET kommt mit list()
// ohne einen einzigen Content-Fetch aus.
// GET  → { top: [...50], count }
// POST { name, score, dist } → { rank, improved, best?, top: [...10], count }
import { put, del, list } from '@vercel/blob';

const PREFIX = 'entries/';
const MAX_ENTRIES = 200;

const b64e = (s) => Buffer.from(s, 'utf8').toString('base64url');
const b64d = (s) => { try { return Buffer.from(s, 'base64url').toString('utf8'); } catch { return null; } };

function parse(blobs) {
  const seen = new Map(); // nameLower → bester Eintrag (Duplikate aus Races dedupen)
  for (const b of blobs) {
    const m = b.pathname.match(/^entries\/(\d{7})-([A-Za-z0-9_-]+)-(\d+)$/);
    if (!m) continue;
    const name = b64d(m[2]);
    if (!name) continue;
    const e = { name, score: parseInt(m[1], 10), dist: parseInt(m[3], 10), url: b.url, pathname: b.pathname };
    const key = name.toLowerCase();
    const prev = seen.get(key);
    if (!prev || e.score > prev.score) seen.set(key, e);
  }
  return [...seen.values()].sort((a, b) => b.score - a.score);
}

async function loadAll() {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  return { blobs, entries: parse(blobs) };
}

const pub = ({ name, score, dist }) => ({ name, score, dist });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const { entries } = await loadAll();
    return res.status(200).json({ top: entries.slice(0, 50).map(pub), count: entries.length });
  }

  if (req.method === 'POST') {
    const { name, score, dist } = req.body || {};
    const clean = String(name || '').trim().replace(/[^\p{L}\p{N} _\-.]/gu, '').slice(0, 12);
    const s = Math.floor(Number(score));
    const d = Math.floor(Number(dist));
    // Plausibilität: Score ist Distanz + Zellen×Combo — großzügig gedeckelt
    const valid = clean.length >= 2
      && Number.isFinite(s) && s >= 0 && s <= 500000
      && Number.isFinite(d) && d >= 0 && d <= 50000
      && s <= d * 130 + 8000;
    if (!valid) return res.status(400).json({ error: 'invalid' });

    const { blobs, entries } = await loadAll();
    const key = clean.toLowerCase();
    const existing = entries.find((e) => e.name.toLowerCase() === key);

    if (existing && s <= existing.score) {
      const rank = entries.indexOf(existing) + 1;
      return res.status(200).json({ rank, improved: false, best: existing.score, top: entries.slice(0, 10).map(pub), count: entries.length });
    }

    // neuen Eintrag schreiben, danach alte Blobs desselben Namens räumen
    const pathname = `${PREFIX}${String(s).padStart(7, '0')}-${b64e(clean)}-${d}`;
    await put(pathname, '1', { access: 'public', addRandomSuffix: false, allowOverwrite: true });
    const stale = blobs.filter((b) => {
      const m = b.pathname.match(/^entries\/(\d{7})-([A-Za-z0-9_-]+)-\d+$/);
      return m && (b64d(m[2]) || '').toLowerCase() === key && b.pathname !== pathname;
    });
    // Liste >250 → unterste über 200 hinaus mit abräumen
    const overflow = entries.length > 250 ? entries.slice(MAX_ENTRIES).map((e) => e.url) : [];
    const trash = [...stale.map((b) => b.url), ...overflow];
    if (trash.length) await del(trash).catch(() => {});

    const updated = entries.filter((e) => e.name.toLowerCase() !== key);
    updated.push({ name: clean, score: s, dist: d });
    updated.sort((a, b) => b.score - a.score);
    const rank = updated.findIndex((e) => e.name.toLowerCase() === key) + 1;
    return res.status(200).json({ rank, improved: true, top: updated.slice(0, 10).map(pub), count: updated.length });
  }

  return res.status(405).json({ error: 'method' });
}
