// NEON DASH — handgebaute Pattern-Chunks (Konzept 2.3: nicht random spawnen)
// Koordinaten relativ zum Chunk-Anfang. ground = Dach-Segmente (crumble:true = Bröckel-Plattform),
// Lücken dazwischen = Abgrund. cells = Energie-Zellen (Bögen zeigen die Ideallinie),
// pu = optionaler Power-up-Slot. difficulty 1–3 steuert, was früh im Run erlaubt ist.
// Fairness: aufeinanderfolgende Pflicht-Aktionen ≥170 px Abstand (≥0,5 s bei Max-Speed 330).

function cellLine(x, y, n, dx = 18) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ x: x + i * dx, y });
  return pts;
}

// Zellen-Bogen über einem Sprung — Apex ~Sprunghöhe, zeigt die Ideallinie
function cellArc(cx, n = 5, apex = 172, base = 208, span = 84) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * 2 - 1; // -1..1
    pts.push({ x: cx + (t * span) / 2, y: base - (1 - t * t) * (base - apex) });
  }
  return pts;
}

const CHUNKS = [
  // ---- Schwierigkeit 1 — jede Falle einzeln eingeführt ----
  {
    id: 'warmup', difficulty: 1, len: 480,
    ground: [{ x: 0, w: 480 }],
    obstacles: [{ type: 'block', x: 300 }],
    cells: [...cellLine(100, 214, 5), ...cellArc(308)],
  },
  {
    id: 'gap-jump', difficulty: 1, len: 560,
    ground: [{ x: 0, w: 200 }, { x: 270, w: 290 }],
    obstacles: [{ type: 'block', x: 430 }],
    cells: [...cellArc(235, 5, 168), ...cellLine(310, 214, 4)],
  },
  {
    id: 'slide-intro', difficulty: 1, len: 460,
    ground: [{ x: 0, w: 460 }],
    obstacles: [{ type: 'bar', x: 220 }],
    cells: [...cellLine(120, 214, 4), ...cellLine(196, 224, 4), ...cellLine(320, 214, 4)],
  },
  {
    id: 'drone-intro', difficulty: 1, len: 520,
    ground: [{ x: 0, w: 520 }],
    obstacles: [{ type: 'drone-low', x: 280 }],
    cells: [...cellLine(90, 214, 4), ...cellArc(288), ...cellLine(390, 214, 4)],
  },
  {
    id: 'coin-road', difficulty: 1, len: 480, // Verschnaufpause mit Belohnung
    ground: [{ x: 0, w: 480 }],
    obstacles: [],
    cells: [...cellLine(80, 214, 6), ...cellArc(260, 5, 178), ...cellLine(340, 214, 6)],
    pu: { x: 260, y: 176 },
  },

  // ---- Schwierigkeit 2 — Kombinationen ----
  {
    id: 'slide-alley', difficulty: 2, len: 540,
    ground: [{ x: 0, w: 540 }],
    obstacles: [{ type: 'bar', x: 170 }, { type: 'bar', x: 360 }],
    cells: [...cellLine(146, 224, 4), ...cellLine(336, 224, 4), ...cellLine(450, 214, 4)],
  },
  {
    id: 'rhythm', difficulty: 2, len: 640,
    ground: [{ x: 0, w: 640 }],
    obstacles: [{ type: 'block', x: 150 }, { type: 'block', x: 330 }, { type: 'block', x: 510 }],
    cells: [...cellArc(158), ...cellArc(338), ...cellArc(518)],
  },
  {
    id: 'high-low', difficulty: 2, len: 560,
    ground: [{ x: 0, w: 560 }],
    obstacles: [{ type: 'wall', x: 180 }, { type: 'bar', x: 380 }],
    cells: [...cellArc(186, 5, 166), ...cellLine(356, 224, 4)],
  },
  {
    id: 'drone-decision', difficulty: 2, len: 580,
    ground: [{ x: 0, w: 580 }],
    obstacles: [{ type: 'drone-high', x: 210 }, { type: 'drone-low', x: 420 }],
    cells: [...cellLine(180, 222, 4), ...cellArc(428)],
  },
  {
    id: 'gap-chain', difficulty: 2, len: 660,
    ground: [{ x: 0, w: 160 }, { x: 230, w: 170 }, { x: 470, w: 190 }],
    obstacles: [],
    cells: [...cellArc(195, 5, 168), ...cellArc(435, 5, 168)],
    pu: { x: 315, y: 172 },
  },
  {
    id: 'laser-intro', difficulty: 2, len: 580,
    ground: [{ x: 0, w: 580 }],
    obstacles: [{ type: 'laser', x: 320 }],
    cells: [...cellLine(120, 214, 4), ...cellLine(420, 214, 4)],
  },

  // ---- Schwierigkeit 3 — volle Breitseite ----
  {
    id: 'double-trouble', difficulty: 3, len: 640,
    ground: [{ x: 0, w: 180 }, { x: 270, w: 370 }],
    obstacles: [{ type: 'block', x: 350 }, { type: 'bar', x: 530 }],
    cells: [...cellArc(225, 5, 162), ...cellArc(358), ...cellLine(506, 224, 4)],
  },
  {
    id: 'crumble-run', difficulty: 3, len: 620,
    ground: [
      { x: 0, w: 150 },
      { x: 170, w: 90, crumble: true },
      { x: 280, w: 90, crumble: true },
      { x: 390, w: 230 },
    ],
    obstacles: [],
    cells: [...cellLine(180, 210, 4), ...cellLine(290, 210, 4), ...cellLine(440, 214, 4)],
  },
  {
    id: 'laser-gauntlet', difficulty: 3, len: 660,
    ground: [{ x: 0, w: 660 }],
    obstacles: [{ type: 'laser', x: 250 }, { type: 'drone-low', x: 480 }],
    cells: [...cellLine(330, 214, 4), ...cellArc(488)],
  },
  {
    id: 'tower-slalom', difficulty: 3, len: 660,
    ground: [{ x: 0, w: 660 }],
    obstacles: [{ type: 'wall', x: 170 }, { type: 'block', x: 350 }, { type: 'bar', x: 530 }],
    cells: [...cellArc(176, 5, 166), ...cellArc(358), ...cellLine(506, 224, 4)],
  },
  {
    id: 'sky-cells', difficulty: 3, len: 640,
    ground: [{ x: 0, w: 260 }, { x: 330, w: 310 }],
    obstacles: [{ type: 'drone-high', x: 470 }],
    cells: [...cellArc(295, 5, 164), ...cellLine(430, 222, 4)],
    pu: { x: 160, y: 176 },
  },
];
