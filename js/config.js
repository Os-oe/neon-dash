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

  // Greybox-Farben (Neon-Palette als Vorgriff auf 2.9)
  COL: {
    bg: 0x1a1c2c,
    ground: 0x33345c,
    groundEdge: 0x41f6f6,
    player: 0x41f6f6,
    playerSlide: 0xff8c42,
    obstacle: 0xff2079,
    dead: 0xff4040,
  },

  PX_PER_M: 10,           // 10 Pixel = 1 Meter für die Distanz-Anzeige
};
