// Kamera-Bot für Video-Aufnahmen: spielt ehrlich (kein Invuln), liest Fallen + Lücken voraus.
window._bot = setInterval(() => {
  const sc = window.game.scene.getScene('game');
  if (!sc || !sc.player || sc.dead || !sc.player.body) return;
  const body = sc.player.body;
  const px = sc.player.x;
  const speed = sc.speed;
  const look = speed * 0.52 + 40;
  const grounded = body.blocked.down || body.touching.down;
  let jump = false;
  let slide = false;

  sc.obstacleGroup.children.iterate((o) => {
    if (!o || !o.body) return;
    const dx = o.x - px;
    if (dx < 6 || dx > look) return;
    const t = o.trapType;
    if (t === 'bar' || t === 'drone-low') slide = true;
    else if (t === 'block' || t === 'wall') { if (dx < speed * 0.34 + 24) jump = true; }
    else if (t === 'laser') {
      // Beam hoch → drunter durchlaufen; Beam tief und nah → Timing-Jump
      if (o.y >= 207 && dx < speed * 0.30 + 20) jump = true;
    }
  });

  // Lücken-Check direkt voraus
  const probe = px + speed * 0.34 + 10;
  let groundAhead = false;
  let groundUnder = false;
  sc.groundGroup.children.iterate((g) => {
    if (!g || !g.body || g.body.checkCollision.none) return;
    const l = g.x - g.width / 2;
    const r = g.x + g.width / 2;
    if (probe >= l && probe <= r) groundAhead = true;
    if (px >= l - 4 && px <= r + 4) groundUnder = true;
  });
  if (!groundAhead && grounded) jump = true;

  // In der Luft über dem Abgrund, fallend, kein Boden in Reichweite → Double-Jump
  if (!grounded && body.velocity.y > 60 && !groundUnder && sc.jumpsUsed < 2) jump = true;

  if (jump && !sc.jumpHeld) {
    sc.onJumpPressed();
    setTimeout(() => sc.onJumpReleased(), 180);
  }
  sc.touchSlide = slide && !jump;
}, 60);
