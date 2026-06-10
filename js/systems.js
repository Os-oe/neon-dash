// NEON DASH — Persistenz (localStorage), Missionen, Skins

const SAVE_KEY = 'neon-dash.save';

const Save = {
  data: null,

  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* korrupte Saves verwerfen */ }
    if (!d) {
      d = {
        best: parseInt(localStorage.getItem('neon-dash.best') || '0', 10), // Migration Greybox-Key
        totalCells: 0,
        totalRuns: 0,
        activeSkin: 'volt',
        missions: { active: [], done: [] },
      };
    }
    if (!d.missions.active.length) {
      d.missions.active = MISSIONS.filter((m) => !d.missions.done.includes(m.id))
        .slice(0, 3).map((m) => m.id);
    }
    this.data = d;
    return d;
  },

  persist() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
  },
};

const Missions = {
  // prüft alle aktiven Missionen gegen die Run-Stats; gibt frisch erledigte zurück
  check(stats) {
    const d = Save.data;
    const completed = [];
    for (const id of [...d.missions.active]) {
      const m = MISSIONS.find((x) => x.id === id);
      if (!m) continue;
      const val = this.metricValue(m.metric, stats);
      if (val >= m.target) {
        completed.push(m);
        d.missions.done.push(m.id);
        d.missions.active = d.missions.active.filter((x) => x !== m.id);
        d.totalCells += MISSION_REWARD; // Belohnungs-Zellen
        const next = MISSIONS.find((x) => !d.missions.done.includes(x.id) && !d.missions.active.includes(x.id));
        if (next) d.missions.active.push(next.id);
      }
    }
    if (completed.length) Save.persist();
    return completed;
  },

  metricValue(metric, stats) {
    switch (metric) {
      case 'runDist': return stats.runDist;
      case 'runCells': return stats.runCells;
      case 'runNear': return stats.runNear;
      case 'runMult': return stats.runMult;
      case 'runSlides': return stats.runSlides;
      case 'runOverdrives': return stats.runOverdrives;
      case 'totalCells': return Save.data.totalCells;
      case 'totalRuns': return Save.data.totalRuns;
      default: return 0;
    }
  },

  activeList() {
    return Save.data.missions.active
      .map((id) => MISSIONS.find((m) => m.id === id)).filter(Boolean);
  },
};

const Skins = {
  unlocked(skin) { return Save.data.totalCells >= skin.cost; },
  active() { return SKINS.find((s) => s.id === Save.data.activeSkin) || SKINS[0]; },
  select(id) {
    const s = SKINS.find((x) => x.id === id);
    if (s && this.unlocked(s)) { Save.data.activeSkin = id; Save.persist(); return true; }
    return false;
  },
};
