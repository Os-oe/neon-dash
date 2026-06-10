// NEON DASH — globale Bestenliste (Vercel Function + Blob-Store)
// GET  → { top: [...50], count }
// POST { name, score, dist } → { rank, improved, best?, top: [...10], count }
// Ein Eintrag pro Name (case-insensitiv), nur der beste Score bleibt.
import { put, list } from '@vercel/blob';

const PATH = 'leaderboard.json';
const MAX_ENTRIES = 200;

async function load() {
  try {
    const { blobs } = await list({ prefix: PATH, limit: 1 });
    if (!blobs.length) return [];
    // Cache-Buster: Blob-CDN cached, wir wollen den frischen Stand
    const res = await fetch(blobs[0].url + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function save(entries) {
  await put(PATH, JSON.stringify(entries), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const entries = await load();
    return res.status(200).json({ top: entries.slice(0, 50), count: entries.length });
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

    let entries = await load();
    const key = clean.toLowerCase();
    const existing = entries.find((e) => e.name.toLowerCase() === key);
    if (existing && s <= existing.score) {
      const rank = entries.indexOf(existing) + 1;
      return res.status(200).json({ rank, improved: false, best: existing.score, top: entries.slice(0, 10), count: entries.length });
    }
    if (existing) {
      existing.score = s;
      existing.dist = d;
      existing.ts = Date.now();
    } else {
      entries.push({ name: clean, score: s, dist: d, ts: Date.now() });
    }
    entries.sort((a, b) => b.score - a.score);
    entries = entries.slice(0, MAX_ENTRIES);
    await save(entries);
    const rank = entries.findIndex((e) => e.name.toLowerCase() === key) + 1;
    return res.status(200).json({ rank, improved: true, top: entries.slice(0, 10), count: entries.length });
  }

  return res.status(405).json({ error: 'method' });
}
