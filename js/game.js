// NEON DASH — GameScene (Phase 2: Systeme)
// Kern-Loop, Spieler, Chunks, Fallen, Zellen, Power-ups inkl. OVERDRIVE,
// Scoring/Combo/Near-Miss, Meilensteine, Bestmarken-Geist, Missionen, Skins, Paletten-Swap.

class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  create() {
    if (!Save.data) Save.load();
    this.physics.world.timeScale = 1; // Slow-Mo-Reste vom letzten Run zurücksetzen

    this.speedBase = CFG.SPEED_START;
    this.speed = CFG.SPEED_START;
    this.elapsed = 0;
    this.distance = 0; // Meter
    this.dead = false;
    this.deathAt = 0;

    // Run-Stats (Scoring + Missionen)
    this.cellScore = 0;
    this.combo = 0;
    this.mult = 1;
    this.stats = { runDist: 0, runCells: 0, runNear: 0, runMult: 1, runSlides: 0, runOverdrives: 0 };

    // Power-up-Zustand
    this.magnetUntil = 0;
    this.x2Until = 0;
    this.shieldOn = false;
    this.invulnUntil = 0;
    this.odActive = false;
    this.odUntil = 0;
    this.lastOdSpawn = -99999;

    // Input-State
    this.jumpBufferedAt = -9999;
    this.lastGroundedAt = -9999;
    this.jumpsUsed = 0;
    this.jumpHeld = false;
    this.sliding = false;

    // Meilensteine / Geist / Palette
    this.nextMilestone = CFG.MILESTONE_M;
    this.ghostPassed = false;
    this.paletteIdx = 1; // Start: Nacht
    this.groundColor = CFG.PALETTES[1].ground;
    this.cameras.main.setBackgroundColor(CFG.PALETTES[1].bg);

    // 2×2-Pixel-Textur für Partikel (Konfetti, Bursts)
    if (!this.textures.exists('px')) {
      const gfx = this.make.graphics({ add: false });
      gfx.fillStyle(0xffffff).fillRect(0, 0, 2, 2);
      gfx.generateTexture('px', 2, 2);
      gfx.destroy();
    }

    // Welt-Gruppen
    this.groundGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this.obstacleGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this.cellGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this.puGroup = this.physics.add.group({ allowGravity: false, immovable: true });

    // Spieler (Farbe = aktiver Skin)
    const p = CFG.PLAYER;
    this.skin = Skins.active();
    this.player = this.add.rectangle(p.x, CFG.GROUND_Y - p.drawH / 2, p.drawW, p.drawH, this.skin.color).setDepth(6);
    this.physics.add.existing(this.player);
    const body = this.player.body;
    body.setSize(p.hitW, p.hitH);
    body.setOffset((p.drawW - p.hitW) / 2, p.drawH - p.hitH);
    body.setMaxVelocityY(CFG.MAX_FALL);

    this.physics.add.collider(this.player, this.groundGroup, (pl, g) => {
      if (g.isCrumble && pl.body.touching.down) Traps.triggerCrumble(this, g);
    });
    this.physics.add.overlap(this.player, this.obstacleGroup, (pl, o) => this.onHit(o));
    this.physics.add.overlap(this.player, this.cellGroup, (pl, c) => this.collectCell(c));
    this.physics.add.overlap(this.player, this.puGroup, (pl, pu) => this.collectPU(pu));

    // Start-Runway, dann Chunks
    this.spawnX = 0;
    this.makeGround(-20, 540);
    this.spawnX = 520;
    this.lastChunkId = null;

    // Input — Space/Up/W = Jump, Down/S = Slide, Pointer = Jump (Touch), 1/2/3 = Skin
    const kb = this.input.keyboard;
    kb.addCapture('SPACE,UP,DOWN');
    this.keysDown = kb.addKeys({ down: 'DOWN', s: 'S' });
    for (const k of ['SPACE', 'UP', 'W']) {
      kb.on('keydown-' + k, (e) => { if (!e.repeat) this.onJumpPressed(); });
      kb.on('keyup-' + k, () => this.onJumpReleased());
    }
    this.input.on('pointerdown', () => this.onJumpPressed());
    this.input.on('pointerup', () => this.onJumpReleased());
    for (const [key, idx] of [['ONE', 0], ['TWO', 1], ['THREE', 2]]) {
      kb.on('keydown-' + key, () => this.trySelectSkin(idx));
    }

    this.buildHud();
    this.toastY = 0;
  }

  buildHud() {
    const style = { fontFamily: 'monospace', fontSize: '10px', color: '#c8d6ff' };
    this.scoreText = this.add.text(6, 4, '0', { ...style, fontSize: '14px', color: '#ffffff' }).setDepth(10);
    this.distText = this.add.text(6, 20, '0 m', style).setDepth(10);
    this.cellText = this.add.text(6, 32, '⚡0', { ...style, color: '#ffd24a' }).setDepth(10);
    this.comboText = this.add.text(CFG.W / 2, 6, '', { ...style, fontSize: '12px' }).setOrigin(0.5, 0).setDepth(10);
    this.bestText = this.add.text(CFG.W - 6, 4, 'BEST ' + Save.data.best + ' m', style).setOrigin(1, 0).setDepth(10);
    this.puText = this.add.text(CFG.W - 6, 18, '', { ...style, color: '#6ee787' }).setOrigin(1, 0).setDepth(10);
    this.odBar = this.add.rectangle(CFG.W / 2, 24, 0, 4, CFG.COL.overdrive).setDepth(10).setVisible(false);
    // Bestmarken-Geist
    this.ghostLine = this.add.rectangle(0, CFG.H / 2 + 20, 2, CFG.H - 80, 0xffffff, 0.35).setDepth(3).setVisible(false);
    this.ghostLabel = this.add.text(0, 56, 'BEST', { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' })
      .setOrigin(0.5).setAlpha(0.6).setDepth(3).setVisible(false);
    this.overlay = null;
  }

  // ---------- Welt-Bau ----------

  makeWorldRect(x, y, w, h, color, group) {
    const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, color);
    group.add(rect); // Physics-Group aktiviert den Body und wendet die Group-Defaults an
    rect.body.setVelocityX(-this.speed);
    return rect;
  }

  makeGround(x, w, crumble) {
    const h = CFG.H - CFG.GROUND_Y;
    const color = crumble ? CFG.COL.crumble : this.groundColor;
    const g = this.makeWorldRect(x, CFG.GROUND_Y, w, h, color, this.groundGroup);
    g.body.friction.x = 0; // Boden zieht Spieler nicht mit nach links
    g.isCrumble = !!crumble;
    g.isGround = true;
    const edge = this.add.rectangle(x + w / 2, CFG.GROUND_Y + 1, w, 2, CFG.COL.groundEdge);
    g.edge = edge;
    return g;
  }

  makeCell(x, y) {
    const c = this.makeWorldRect(x - 3, y - 3, 6, 6, CFG.COL.cell, this.cellGroup);
    c.isCell = true;
    this.tweens.add({ targets: c, alpha: 0.6, duration: 300 + (x % 200), yoyo: true, repeat: -1 });
    return c;
  }

  makePU(x, y, type) {
    const colors = { magnet: CFG.COL.magnet, shield: CFG.COL.shield, x2: CFG.COL.x2, od: CFG.COL.overdrive };
    const pu = this.makeWorldRect(x - 6, y - 6, 12, 12, colors[type], this.puGroup);
    pu.puType = type;
    const label = { magnet: 'M', shield: 'S', x2: '2', od: '!' }[type];
    pu.label = this.add.text(pu.x, pu.y, label, { fontFamily: 'monospace', fontSize: '9px', color: '#16161e', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(7);
    this.tweens.add({ targets: pu, scaleX: 1.25, scaleY: 1.25, duration: 350, yoyo: true, repeat: -1 });
    return pu;
  }

  choosePU() {
    // OVERDRIVE selten + frühestens nach 25 s + 45 s Abstand
    const odOk = this.elapsed > 25000 && this.elapsed - this.lastOdSpawn > CFG.OVERDRIVE_COOLDOWN_MS;
    const r = Math.random();
    if (odOk && r < 0.15) { this.lastOdSpawn = this.elapsed; return 'od'; }
    if (r < 0.42) return 'magnet';
    if (r < 0.72) return 'shield';
    return 'x2';
  }

  spawnChunk(chunk) {
    for (const g of chunk.ground) this.makeGround(this.spawnX + g.x, g.w, g.crumble);
    for (const o of chunk.obstacles) Traps.create(this, o.type, this.spawnX + o.x);
    for (const c of chunk.cells || []) this.makeCell(this.spawnX + c.x, c.y);
    if (chunk.pu && Math.random() < CFG.PU_CHANCE) {
      this.makePU(this.spawnX + chunk.pu.x, chunk.pu.y, this.choosePU());
    }
    this.spawnX += chunk.len;
    this.lastChunkId = chunk.id;
  }

  pickChunk() {
    // früh im Run nur leichte Chunks, nie zweimal derselbe hintereinander
    const maxDiff = this.elapsed < 20000 ? 1 : (this.elapsed < 45000 ? 2 : 3);
    const pool = CHUNKS.filter((c) => c.difficulty <= maxDiff && c.id !== this.lastChunkId);
    return Phaser.Utils.Array.GetRandom(pool.length ? pool : CHUNKS);
  }

  // ---------- Input ----------

  onJumpPressed() {
    if (this.dead) { this.tryRestart(); return; }
    this.jumpHeld = true;
    this.jumpBufferedAt = this.time.now;
  }

  onJumpReleased() {
    this.jumpHeld = false;
    if (this.dead || this.odActive) return;
    // Jump-Cut: Loslassen während des Steigens kappt den Sprung
    const body = this.player.body;
    if (body.velocity.y < 0) body.setVelocityY(body.velocity.y * CFG.JUMP_CUT);
  }

  doJump(vel) {
    this.player.body.setVelocityY(vel);
    this.jumpBufferedAt = -9999;
    this.lastGroundedAt = -9999;
  }

  trySelectSkin(idx) {
    const s = SKINS[idx];
    if (!s) return;
    if (Skins.select(s.id)) {
      this.skin = s;
      if (!this.sliding) this.player.setFillStyle(this.odActive ? CFG.COL.overdrive : s.color);
      this.toast(s.name + ' aktiviert', '#c8d6ff');
    } else {
      this.toast(s.name + ' gesperrt — ' + s.cost + '⚡ nötig', '#ff8c8c');
    }
  }

  // ---------- Sammeln ----------

  collectCell(cell) {
    if (this.dead) return;
    this.combo += 1;
    this.mult = Math.min(1 + Math.floor(this.combo / CFG.COMBO_PER_MULT), CFG.COMBO_MAX_MULT);
    this.stats.runMult = Math.max(this.stats.runMult, this.mult);
    const pts = CFG.CELL_POINTS * this.mult * (this.time.now < this.x2Until ? 2 : 1);
    this.cellScore += pts;
    this.stats.runCells += 1;
    Save.data.totalCells += 1;
    this.burst(cell.x, cell.y, CFG.COL.cell, 6);
    cell.destroy();
    this.checkMissions();
  }

  collectPU(pu) {
    if (this.dead) return;
    const type = pu.puType;
    if (pu.label) pu.label.destroy();
    this.burst(pu.x, pu.y, pu.fillColor, 12);
    pu.destroy();
    if (type === 'magnet') { this.magnetUntil = this.time.now + CFG.MAGNET_MS; this.toast('MAGNET', '#58abf5'); }
    if (type === 'shield') { this.shieldOn = true; this.toast('SCHILD', '#6ee787'); }
    if (type === 'x2') { this.x2Until = this.time.now + CFG.X2_MS; this.toast('×2 PUNKTE', '#ffd24a'); }
    if (type === 'od') this.startOverdrive();
  }

  // ---------- OVERDRIVE (Konzept 2.4) ----------

  startOverdrive() {
    this.odActive = true;
    this.odUntil = this.time.now + CFG.OVERDRIVE_MS;
    this.stats.runOverdrives += 1;

    // kurzes Slow-Mo, dann zurück
    this.physics.world.timeScale = 3;
    this.tweens.add({ targets: this.physics.world, timeScale: 1, duration: 450, ease: 'Quad.easeIn' });

    // Screen-Clear: alle Hindernisse auf dem Screen wegsprengen
    const toClear = [];
    this.obstacleGroup.children.iterate((o) => { if (o && o.x < CFG.W + 40) toClear.push(o); });
    for (const o of toClear) {
      this.burst(o.x, o.y, CFG.COL.obstacle, 10);
      Traps.destroyExtras(o);
      o.destroy();
    }
    this.cameras.main.flash(220, 255, 200, 120);
    this.player.setFillStyle(CFG.COL.overdrive);
    this.odBar.setVisible(true);
    this.toast('OVERDRIVE!', '#ff8c42');
    this.checkMissions();
  }

  endOverdrive() {
    this.odActive = false;
    this.player.setFillStyle(this.sliding ? this.skin.slideColor : this.skin.color);
    this.player.setAlpha(1);
    this.odBar.setVisible(false);
    this.invulnUntil = this.time.now + 600; // kurze Schonfrist nach Modus-Ende
  }

  // ---------- Treffer / Tod ----------

  onHit(o) {
    if (this.dead || !o.active) return;
    if (this.odActive) {
      // Treffer beendet nur den Modus (zweite Chance, kein Tod)
      this.burst(o.x, o.y, CFG.COL.obstacle, 10);
      Traps.destroyExtras(o);
      o.destroy();
      this.endOverdrive();
      this.cameras.main.flash(120, 255, 255, 255);
      return;
    }
    if (this.time.now < this.invulnUntil) return;
    if (this.shieldOn) {
      this.shieldOn = false;
      this.invulnUntil = this.time.now + 800;
      this.combo = 0;
      this.mult = 1;
      this.burst(this.player.x, this.player.y, CFG.COL.shield, 14);
      Traps.destroyExtras(o);
      o.destroy();
      this.toast('SCHILD ZERPLATZT', '#6ee787');
      return;
    }
    this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deathAt = this.time.now;
    this.physics.pause();
    this.player.setFillStyle(CFG.COL.dead);

    // Persistenz + Missionen
    const dist = Math.floor(this.distance);
    this.stats.runDist = dist;
    const isBest = dist > Save.data.best;
    if (isBest) Save.data.best = dist;
    Save.data.totalRuns += 1;
    const completed = Missions.check(this.stats);
    Save.persist();

    const score = Math.floor(this.distance) + this.cellScore;
    const lines = [
      'GAME OVER',
      'SCORE ' + score + '   ' + dist + ' m' + (isBest ? ' ★ NEU' : ''),
      '⚡' + this.stats.runCells + '   Combo ×' + this.stats.runMult + '   Near-Miss ' + this.stats.runNear,
      '',
    ];
    for (const m of Missions.activeList()) {
      const val = Math.min(Missions.metricValue(m.metric, this.stats), m.target);
      lines.push('· ' + m.text + '  [' + val + '/' + m.target + ']');
    }
    for (const m of completed) lines.push('✓ ' + m.text + '  +' + MISSION_REWARD + '⚡');
    lines.push('');
    lines.push(SKINS.map((s, i) => {
      const tag = Skins.unlocked(s) ? s.name : s.name + '(' + s.cost + '⚡)';
      return (s.id === Save.data.activeSkin ? '[' + (i + 1) + ']▸' : '[' + (i + 1) + '] ') + tag;
    }).join('  '));
    lines.push('SPACE = RESTART');

    this.overlay = this.add.text(CFG.W / 2, CFG.H / 2, lines.join('\n'), {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(20);
  }

  tryRestart() {
    // 250 ms Lockout, damit ein gehaltener Sprung-Input nicht sofort neu startet
    if (this.time.now - this.deathAt > 250) this.scene.restart();
  }

  // ---------- Feedback-Helfer (Greybox-Stufe; voller Juice-Pass = Phase 4) ----------

  burst(x, y, color, count) {
    const em = this.add.particles(x, y, 'px', {
      speed: { min: 40, max: 120 }, lifespan: 400, quantity: count,
      scale: { start: 1.4, end: 0 }, tint: color, emitting: false,
    }).setDepth(8);
    em.explode(count);
    this.time.delayedCall(500, () => em.destroy());
  }

  toast(text, color) {
    const t = this.add.text(CFG.W / 2, 72 + this.toastY, text, {
      fontFamily: 'monospace', fontSize: '11px', color, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(15);
    this.toastY = (this.toastY + 14) % 42;
    this.tweens.add({
      targets: t, y: t.y - 16, alpha: 0, duration: 1300, ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  milestoneBanner(m) {
    const t = this.add.text(CFG.W + 80, 92, m + ' m', {
      fontFamily: 'monospace', fontSize: '18px', color: '#41f6f6', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(15);
    this.tweens.chain({
      targets: t,
      tweens: [
        { x: CFG.W / 2, duration: 280, ease: 'Back.easeOut' },
        { alpha: 0, duration: 500, delay: 550 },
      ],
      onComplete: () => t.destroy(),
    });
    // Konfetti
    const em = this.add.particles(CFG.W / 2, 84, 'px', {
      speed: { min: 60, max: 160 }, lifespan: 800, gravityY: 200,
      scale: { start: 1.6, end: 0 }, tint: [0x41f6f6, 0xff2079, 0xffd24a, 0x6ee787], emitting: false,
    }).setDepth(14);
    em.explode(26);
    this.time.delayedCall(900, () => em.destroy());
  }

  nearMiss(o) {
    this.stats.runNear += 1;
    this.combo += 1;
    this.mult = Math.min(1 + Math.floor(this.combo / CFG.COMBO_PER_MULT), CFG.COMBO_MAX_MULT);
    this.stats.runMult = Math.max(this.stats.runMult, this.mult);
    this.cellScore += CFG.NEAR_MISS_BONUS * this.mult;
    const t = this.add.text(this.player.x + 14, this.player.y - 22, 'CLOSE!', {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffd24a', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({ targets: t, y: t.y - 14, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    // kurzes Slow-Mo
    this.physics.world.timeScale = 1.5;
    this.time.delayedCall(90, () => { if (!this.dead) this.physics.world.timeScale = 1; });
    this.checkMissions();
  }

  checkMissions() {
    this.stats.runDist = Math.floor(this.distance);
    const completed = Missions.check(this.stats);
    for (const m of completed) this.toast('MISSION ✓ ' + m.text + ' +' + MISSION_REWARD + '⚡', '#6ee787');
    if (completed.length) this.bestText.setText('BEST ' + Save.data.best + ' m');
  }

  // ---------- Game-Loop ----------

  update(time, delta) {
    if (this.dead) return;
    const dt = delta / 1000;
    this.elapsed += delta;

    // Speed-Ramp mit Plateaus, Cap bei 90 s; OVERDRIVE +30 %
    const steps = Math.floor(this.elapsed / CFG.SPEED_STEP_MS);
    this.speedBase = Math.min(CFG.SPEED_START + steps * CFG.SPEED_STEP, CFG.SPEED_MAX);
    this.speed = this.speedBase * (this.odActive ? CFG.OVERDRIVE_SPEED_MULT : 1);
    this.distance += (this.speed * dt) / CFG.PX_PER_M;

    // Welt scrollt — Spawn-Cursor wandert mit
    this.spawnX -= this.speed * dt;
    while (this.spawnX < CFG.W + 250) this.spawnChunk(this.pickChunk());

    this.syncWorld(dt);
    Traps.update(this, time, dt);
    this.updatePlayer(time, dt);
    if (this.dead) return; // Tod innerhalb updatePlayer
    this.updatePowerups(time);
    this.updateScoring(time);
    this.updateHud(time);
  }

  syncWorld(dt) {
    for (const grp of [this.groundGroup, this.obstacleGroup, this.cellGroup, this.puGroup]) {
      const trash = [];
      grp.children.iterate((obj) => {
        if (!obj || !obj.body) return;
        obj.body.setVelocityX(-this.speed);
        if (obj.edge) obj.edge.x = obj.x;
        if (obj.label) obj.label.setPosition(obj.x, obj.y);
        if (obj.x + obj.width / 2 < -80 || obj.y > CFG.H + 100) trash.push(obj);
      });
      for (const obj of trash) {
        if (obj.edge) obj.edge.destroy();
        if (obj.label) obj.label.destroy();
        Traps.destroyExtras(obj);
        grp.remove(obj, true, true);
      }
    }
    // Magnet: Zellen im Radius fliegen zum Spieler
    if (this.time.now < this.magnetUntil) {
      this.cellGroup.children.iterate((c) => {
        if (!c || !c.body) return;
        const dx = this.player.x - c.x;
        const dy = this.player.y - c.y;
        const d = Math.hypot(dx, dy);
        if (d < CFG.MAGNET_RADIUS && d > 2) {
          c.body.setVelocity((dx / d) * 270, (dy / d) * 270);
        }
      });
    }
  }

  updatePlayer(time, dt) {
    const body = this.player.body;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) {
      this.lastGroundedAt = time;
      this.jumpsUsed = 0;
    }

    if (this.odActive) {
      // Hold-to-fly (Jetpack-Physik), gleiche Ein-Knopf-Steuerung
      body.setGravityY(0);
      let vy = body.velocity.y + (this.jumpHeld ? -1400 : 1100) * dt;
      vy = Phaser.Math.Clamp(vy, -180, 200);
      if (this.player.y < 36 && vy < 0) vy = 0;
      body.setVelocityY(vy);
      this.endSlide();
    } else {
      // Fall-Gravitation 2× Steig-Gravitation
      body.setGravityY(body.velocity.y < 0 ? CFG.GRAV_UP : CFG.GRAV_DOWN);

      // Sprung: Input-Buffer + Coyote-Time
      const buffered = time - this.jumpBufferedAt <= CFG.BUFFER_MS;
      const coyote = time - this.lastGroundedAt <= CFG.COYOTE_MS;
      if (buffered) {
        if (grounded || coyote) {
          this.doJump(CFG.JUMP_VEL);
          this.jumpsUsed = 1;
          this.endSlide();
        } else if (this.jumpsUsed < 2) {
          this.doJump(CFG.DJUMP_VEL);
          this.jumpsUsed = 2;
        }
      }

      // Slide: nur am Boden, Hitbox flacher
      const wantSlide = this.keysDown.down.isDown || this.keysDown.s.isDown;
      if (wantSlide && grounded && !this.sliding) this.startSlide();
      if (!wantSlide && this.sliding) this.endSlide();
    }

    // Spieler-x fixieren (Side-Kollision schiebt sonst nach links)
    if (this.player.x < CFG.PLAYER.x) {
      if (this.player.x < 24) return this.die(); // an einer Wand zerquetscht
      this.player.x = Math.min(this.player.x + 40 * dt, CFG.PLAYER.x);
    }
    body.setVelocityX(0);

    // In die Lücke gefallen
    if (this.player.y > CFG.H + 30) return this.die();
  }

  updatePowerups(time) {
    if (this.odActive) {
      const left = this.odUntil - time;
      if (left <= 0) {
        this.endOverdrive();
      } else {
        this.odBar.width = Math.max((left / CFG.OVERDRIVE_MS) * 120, 0);
        this.odBar.setVisible(true);
        // Coin-Regen
        if (!this.lastRain || time - this.lastRain > 230) {
          this.lastRain = time;
          this.makeCell(CFG.W + 16, 120 + Math.random() * 95);
        }
        // letzte 2 s: Warn-Blinken
        if (left < CFG.OVERDRIVE_WARN_MS) {
          this.player.setAlpha(Math.floor(time / 110) % 2 === 0 ? 0.5 : 1);
        }
      }
    }
    const tags = [];
    if (this.shieldOn) tags.push('SCHILD');
    if (time < this.magnetUntil) tags.push('MAGNET');
    if (time < this.x2Until) tags.push('×2');
    this.puText.setText(tags.join('  '));
  }

  updateScoring(time) {
    // Near-Miss: Hindernis passiert den Spieler knapp ohne Treffer (Konzept 2.5)
    const pb = this.player.body;
    this.obstacleGroup.children.iterate((o) => {
      if (!o || !o.body || o.nmDone) return;
      const ob = o.body;
      const dxNear = Math.abs(o.x - this.player.x);
      if (dxNear < 50) {
        const gapX = Math.max(ob.x - (pb.x + pb.width), pb.x - (ob.x + ob.width), 0);
        const gapY = Math.max(ob.y - (pb.y + pb.height), pb.y - (ob.y + ob.height), 0);
        const gap = Math.max(gapX, gapY);
        o.minGap = Math.min(o.minGap ?? 999, gap);
      }
      if (o.x + o.width / 2 < pb.x - 6) {
        o.nmDone = true;
        if ((o.minGap ?? 999) < CFG.NEAR_MISS_GAP) this.nearMiss(o);
      }
    });

    // Meilenstein-Feier alle 250 m, ohne Pause
    if (this.distance >= this.nextMilestone) {
      this.milestoneBanner(this.nextMilestone);
      this.nextMilestone += CFG.MILESTONE_M;
    }

    // Bestmarken-Geist: Marker an der bisherigen Highscore-Distanz
    const best = Save.data.best;
    if (best > 0 && !this.ghostPassed) {
      const gx = this.player.x + (best - this.distance) * CFG.PX_PER_M;
      if (this.distance >= best) {
        this.ghostPassed = true;
        this.ghostLine.setVisible(false);
        this.ghostLabel.setVisible(false);
        this.toast('NEUE BESTMARKE!', '#41f6f6');
        this.burst(this.player.x, this.player.y - 30, 0x41f6f6, 18);
      } else if (gx < CFG.W + 10) {
        this.ghostLine.setPosition(gx, CFG.H / 2 + 20).setVisible(true);
        this.ghostLabel.setPosition(gx, 56).setVisible(true);
      }
    }

    // Paletten-Swap Abend→Nacht→Dämmerung alle 500 m
    const pi = (1 + Math.floor(this.distance / CFG.PALETTE_M)) % CFG.PALETTES.length;
    if (pi !== this.paletteIdx) {
      this.paletteIdx = pi;
      const pal = CFG.PALETTES[pi];
      this.groundColor = pal.ground;
      this.cameras.main.setBackgroundColor(pal.bg);
      this.groundGroup.children.iterate((g) => {
        if (g && g.isGround && !g.isCrumble) g.setFillStyle(pal.ground);
      });
    }
  }

  updateHud() {
    this.scoreText.setText(String(Math.floor(this.distance) + this.cellScore));
    this.distText.setText(Math.floor(this.distance) + ' m');
    this.cellText.setText('⚡' + this.stats.runCells);
    if (this.mult > 1) {
      const cols = ['#ffffff', '#ffffff', '#ffd24a', '#ffd24a', '#ff8c42', '#ff8c42', '#ff4040', '#ff4040'];
      this.comboText.setText('×' + this.mult).setColor(cols[this.mult - 1]).setVisible(true);
    } else {
      this.comboText.setVisible(false);
    }
  }

  startSlide() {
    this.sliding = true;
    this.stats.runSlides += 1;
    const p = CFG.PLAYER;
    this.player.body.setSize(p.hitW, p.slideH);
    this.player.body.setOffset((p.drawW - p.hitW) / 2, p.drawH - p.slideH);
    if (!this.odActive) this.player.setFillStyle(this.skin.slideColor);
  }

  endSlide() {
    if (!this.sliding) return;
    this.sliding = false;
    const p = CFG.PLAYER;
    this.player.body.setSize(p.hitW, p.hitH);
    this.player.body.setOffset((p.drawW - p.hitW) / 2, p.drawH - p.hitH);
    if (!this.odActive) this.player.setFillStyle(this.skin.color);
  }
}

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  width: CFG.W,
  height: CFG.H,
  pixelArt: true,
  backgroundColor: '#1a1c2c',
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scale: {
    mode: Phaser.Scale.NONE,
    zoom: Phaser.Scale.MAX_ZOOM, // Integer-Scaling
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});
