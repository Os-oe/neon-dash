// NEON DASH — globale Konstanten (Tuning-Werte zentral, damit Balancing-Pass an einer Stelle dreht)
const CFG = {
  W: 480,
  H: 270,
  GROUND_Y: 230,          // Oberkante der Dächer

  // Physik — Fall-Gravitation 2× Steig-Gravitation (Pflicht, Konzept 2.2)
  GRAV_UP: 900,
  GRAV_DOWN: 1800,
  JUMP_VEL: -300,
  DJUMP_VEL: -275,
  JUMP_CUT: 0.45,         // Faktor auf vy beim Loslassen während des Steigens
  MAX_FALL: 460,

  // Unsichtbare Fairness-Mechanik
  COYOTE_MS: 90,
  BUFFER_MS: 100,

  // Speed-Ramp mit Plateaus, Cap bei ~90 s
  SPEED_START: 150,
  SPEED_STEP: 30,
  SPEED_STEP_MS: 15000,
  SPEED_MAX: 330,

  // Spieler — Hitbox kleiner als Sprite (Pflicht)
  PLAYER: {
    x: 90,
    drawW: 16, drawH: 24,
    hitW: 12, hitH: 20,
    slideH: 10,
  },

  // Scoring (Konzept 2.5)
  CELL_POINTS: 10,
  NEAR_MISS_BONUS: 25,
  NEAR_MISS_GAP: 12,      // px Abstand, ab dem ein Vorbeiflug als Near-Miss zählt
  COMBO_PER_MULT: 5,      // alle 5 Combo-Events steigt der Multiplikator
  COMBO_MAX_MULT: 8,
  MILESTONE_M: 250,

  // Power-ups (Konzept 2.4)
  MAGNET_MS: 8000,
  MAGNET_RADIUS: 110,
  X2_MS: 10000,
  OVERDRIVE_MS: 10000,
  OVERDRIVE_WARN_MS: 2000,
  OVERDRIVE_SPEED_MULT: 1.3,
  OVERDRIVE_COOLDOWN_MS: 45000, // Mindestabstand zwischen zwei OVERDRIVE-Spawns
  PU_CHANCE: 0.6,               // Chance, dass ein Chunk-Slot belegt wird

  // Fallen-Tuning
  DRONE_BLINK_S: 0.7,     // rotes Blinken, wenn Drohne 0,7 s entfernt ist
  LASER_LO_Y: 224,
  LASER_HI_Y: 188,
  LASER_PERIOD_MS: 1600,
  CRUMBLE_MS: 350,        // Zeit vom Betreten bis zum Einsturz

  // Paletten-Phasen alle 500 m: Abend → Nacht → Dämmerung (Konzept 2.5)
  PALETTE_M: 500,
  PALETTES: [
    { bg: 0x2b1a3e, ground: 0x46336c, name: 'Abend' },
    { bg: 0x1a1c2c, ground: 0x33345c, name: 'Nacht' },
    { bg: 0x3e2433, ground: 0x6c3a52, name: 'Dämmerung' },
  ],

  // Greybox-Farben (Neon-Palette als Vorgriff auf 2.9)
  COL: {
    groundEdge: 0x41f6f6,
    player: 0x41f6f6,
    playerSlide: 0xff8c42,
    obstacle: 0xff2079,
    wall: 0xff5c9d,
    drone: 0xff2079,
    droneBlink: 0xff4040,
    laser: 0xff2079,
    laserPylon: 0x8a8aa8,
    crumble: 0x5a5a86,
    cell: 0xffd24a,
    dead: 0xff4040,
    magnet: 0x58abf5,
    shield: 0x6ee787,
    x2: 0xffd24a,
    overdrive: 0xff8c42,
  },

  PX_PER_M: 10,           // 10 Pixel = 1 Meter für die Distanz-Anzeige
};

// Skins — rein kosmetisch, Unlock über gesammelte Zellen (lebenszeitlich). Skin 3 = „Ori" (Brand-Tie-in).
const SKINS = [
  { id: 'volt', name: 'VOLT', color: 0x41f6f6, slideColor: 0xff8c42, cost: 0 },
  { id: 'blaze', name: 'BLAZE', color: 0xff2079, slideColor: 0xffd24a, cost: 150 },
  { id: 'ori', name: 'ORI', color: 0xfff7e0, slideColor: 0xffd24a, cost: 400 },
];

// Missions-Pool — immer 3 aktiv, erledigt → ersetzt → +25 Zellen (Konzept 2.5)
const MISSIONS = [
  { id: 'run-dist-400', text: '400 m am Stück', metric: 'runDist', target: 400 },
  { id: 'run-dist-800', text: '800 m am Stück', metric: 'runDist', target: 800 },
  { id: 'run-cells-30', text: '30 Zellen in einem Run', metric: 'runCells', target: 30 },
  { id: 'run-cells-60', text: '60 Zellen in einem Run', metric: 'runCells', target: 60 },
  { id: 'run-near-3', text: '3 Near-Misses in einem Run', metric: 'runNear', target: 3 },
  { id: 'run-near-8', text: '8 Near-Misses in einem Run', metric: 'runNear', target: 8 },
  { id: 'run-combo-x4', text: 'Combo ×4 erreichen', metric: 'runMult', target: 4 },
  { id: 'run-slide-10', text: '10× sliden in einem Run', metric: 'runSlides', target: 10 },
  { id: 'run-od-1', text: 'OVERDRIVE zünden', metric: 'runOverdrives', target: 1 },
  { id: 'total-cells-200', text: '200 Zellen gesamt', metric: 'totalCells', target: 200 },
  { id: 'total-cells-500', text: '500 Zellen gesamt', metric: 'totalCells', target: 500 },
  { id: 'total-runs-10', text: '10 Runs spielen', metric: 'totalRuns', target: 10 },
];

const MISSION_REWARD = 25;
