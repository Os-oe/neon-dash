// NEON DASH — Bestenlisten-Client + Namens-Dialog (HTML-Overlay, mobil-tauglich)
// Offline/lokal ohne /api: alle Calls scheitern leise, das Spiel läuft normal weiter.

const LB = {
  api: '/api/leaderboard',
  name: localStorage.getItem('neon-dash.player') || '',
  cache: null,

  async top() {
    try {
      const r = await fetch(this.api, { cache: 'no-store' });
      if (!r.ok) return null;
      this.cache = await r.json();
      return this.cache;
    } catch {
      return null;
    }
  },

  async submit(score, dist) {
    if (!this.name) return null;
    try {
      const r = await fetch(this.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.name, score, dist }),
      });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  },

  setName(n) {
    this.name = n;
    localStorage.setItem('neon-dash.player', n);
  },

  // freiwillige E-Mail (Making-of + Updates) — fire-and-forget
  subscribe(email) {
    try {
      fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).catch(() => {});
    } catch { /* offline egal */ }
  },
};

// Namens-Dialog: einmalig beim ersten eintragswürdigen Run. ENTER/OK bestätigt,
// ESC/SPÄTER überspringt (wird beim nächsten Run wieder angeboten).
function showNameInput(onDone) {
  const wrap = document.getElementById('lb-input');
  const field = document.getElementById('lb-name');
  const mail = document.getElementById('lb-mail');
  const ok = document.getElementById('lb-ok');
  const skip = document.getElementById('lb-skip');
  wrap.style.display = 'flex';
  field.value = LB.name || '';
  setTimeout(() => field.focus(), 50);

  const close = (name) => {
    wrap.style.display = 'none';
    ok.onclick = skip.onclick = field.onkeydown = mail.onkeydown = null;
    onDone(name);
  };
  const confirm = () => {
    const v = field.value.trim().slice(0, 12);
    if (v.length < 2) { field.style.borderColor = '#ff4040'; return; }
    const m = mail.value.trim();
    if (m && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m)) LB.subscribe(m);
    close(v);
  };
  const keys = (e) => {
    e.stopPropagation(); // Spiel-Input nicht triggern
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape') close(null);
  };
  ok.onclick = confirm;
  skip.onclick = () => close(null);
  field.onkeydown = keys;
  mail.onkeydown = keys;
}
