// NEON DASH — handgebaute Pattern-Chunks (Konzept 2.3: nicht random spawnen)
// Koordinaten relativ zum Chunk-Anfang. ground = Dach-Segmente, Lücken dazwischen = Abgrund.
// difficulty 1–3 steuert, was früh im Run erlaubt ist.
const CHUNKS = [
  {
    id: 'warmup',
    difficulty: 1,
    len: 480,
    ground: [{ x: 0, w: 480 }],
    obstacles: [{ type: 'block', x: 300 }],
  },
  {
    id: 'gap-jump',
    difficulty: 1,
    len: 560,
    ground: [{ x: 0, w: 200 }, { x: 270, w: 290 }],
    obstacles: [{ type: 'block', x: 430 }],
  },
  {
    id: 'slide-alley',
    difficulty: 2,
    len: 460,
    ground: [{ x: 0, w: 460 }],
    obstacles: [{ type: 'bar', x: 160 }, { type: 'bar', x: 320 }],
  },
  {
    id: 'double-trouble',
    difficulty: 3,
    len: 620,
    ground: [{ x: 0, w: 180 }, { x: 270, w: 350 }],
    obstacles: [{ type: 'block', x: 340 }, { type: 'bar', x: 500 }],
  },
  {
    id: 'rhythm',
    difficulty: 2,
    len: 620,
    ground: [{ x: 0, w: 620 }],
    obstacles: [{ type: 'block', x: 140 }, { type: 'block', x: 300 }, { type: 'block', x: 460 }],
  },
];
