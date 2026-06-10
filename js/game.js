// NEON DASH — GameScene (Phase 2: Systeme)
// Kern-Loop, Spieler, Chunks, Fallen, Zellen, Power-ups inkl. OVERDRIVE,
// Scoring/Combo/Near-Miss, Meilensteine, Bestmarken-Geist, Missionen, Skins, Paletten-Swap.

class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  preload() {
    for (const s of ['volt', 'blaze', 'ori']) {
      for (const p of ['run1', 'run2', 'run3', 'run4', 'jump', 'slide', 'fly', 'death']) {
        this.load.image(s + '-' + p, 'assets/sprites/' + s + '-' + p + '.png');
      }
    }
    const imgs = {
      sky: 'layers/sky.png', far: 'layers/far.png', near: 'layers/near.png', signs: 'layers/signs.png',
      roof: 'layers/roof.png', crumbleTex: 'layers/crumble.png', logo: 'ui/logo.png',
      block: 'sprites/block.png', bar: 'sprites/bar.png', wall: 'sprites/wall.png',
      drone: 'sprites/drone-b.png', pylon: 'sprites/pylon.png', cell: 'sprites/cell.png',
      'pu-magnet': 'sprites/pu-magnet.png', 'pu-shield': 'sprites/pu-shield.png',
      'pu-x2': 'sprites/pu-x2.png', 'pu-od': 'sprites/pu-od.png',
    };
    for (const [k, v] of Object.entries(imgs)) this.load.image(k, 'assets/' + v);
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

    // Juice-State (Konzept 2.6)
    this.trauma = 0;          // Screen-Shake, decaying
    this.wasGrounded = true;
    this.lastFallV = 0;
    this.cellChain = 0;       // Pitch-Ladder
    this.lastCellAt = -9999;
    this.lastTrailAt = 0;
    this.lastSpeedLineAt = 0;
    this.lastDustAt = 0;
    this.lastOdTickAt = 0;

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

    // Parallax-Stadt (Konzept 2.8): Himmel → ferne Skyline → nahe Skyline → Neon-Schilder
    // Distanz-Dimming (Tint + Alpha), damit das Spielfeld vorne lesbar bleibt
    this.bgLayers = [];
    this.bgSpeeds = [0.03, 0.12, 0.28, 0.55];
    const layerCfg = [
      { key: 'sky', tint: 0xffffff, alpha: 1 },
      { key: 'far', tint: 0x6a6a92, alpha: 0.95 },
      { key: 'near', tint: 0x9090b8, alpha: 0.95 },
      { key: 'signs', tint: 0xb8b8d0, alpha: 0.9 },
    ];
    for (const [i, cfg] of layerCfg.entries()) {
      this.bgLayers.push(
        this.add.tileSprite(CFG.W / 2, CFG.H / 2, CFG.W, CFG.H, cfg.key)
          .setDepth(i).setTint(cfg.tint).setAlpha(cfg.alpha)
      );
    }
    // dunkle Lauf-Zone hinter dem Spielfeld, damit Held + Fallen vorne knallen
    this.add.rectangle(CFG.W / 2, 205, CFG.W, 130, 0x0b0b12, 0.32).setDepth(3.5);
    // Farb-Grading je Tageszeit-Phase (wirkt auf alle Bild-Layer)
    this.gradeOverlay = this.add.rectangle(CFG.W / 2, CFG.H / 2, CFG.W, CFG.H, 0x000000, 0).setDepth(8);

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
    // Physik-Puppet: der unsichtbare Body steuert, gezeichnet wird der Pose-Sprite
    this.player.setVisible(false);
    this.playerSpr = this.add.sprite(p.x, CFG.GROUND_Y, this.skin.id + '-run1').setOrigin(0.5, 1).setDepth(6);
    this.makeAnims();

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
    // Touch: ganzer Screen = Jump, unteres Band halten = Slide (Konzept 2.2)
    this.touchSlide = false;
    this.input.on('pointerdown', (p) => {
      if (this.dead) { this.tryRestart(); return; }
      if (p.worldY > 205) this.touchSlide = true;
      else this.onJumpPressed();
    });
    this.input.on('pointerup', () => {
      this.touchSlide = false;
      this.onJumpReleased();
    });
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
    // Mute: Icon oben rechts + Taste M
    this.muteBtn = this.add.text(CFG.W - 6, 32, AudioSys.muted ? '♪ AUS' : '♪', {
      fontFamily: 'monospace', fontSize: '10px', color: AudioSys.muted ? '#5a5a86' : '#41f6f6',
    }).setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true });
    const toggleMute = () => {
      AudioSys.setMuted(!AudioSys.muted);
      this.muteBtn.setText(AudioSys.muted ? '♪ AUS' : '♪').setColor(AudioSys.muted ? '#5a5a86' : '#41f6f6');
    };
    this.muteBtn.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); toggleMute(); });
    this.input.keyboard.on('keydown-M', toggleMute);
    // Bestmarken-Geist
    this.ghostLine = this.add.rectangle(0, CFG.H / 2 + 20, 2, CFG.H - 80, 0xffffff, 0.35).setDepth(3).setVisible(false);
    this.ghostLabel = this.add.text(0, 56, 'BEST', { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' })
      .setOrigin(0.5).setAlpha(0.6).setDepth(3).setVisible(false);
    this.overlay = null;
  }

  // ---------- Welt-Bau ----------

  makeAnims() {
    for (const s of ['volt', 'blaze', 'ori']) {
      if (this.anims.exists(s + '-run')) continue;
      this.anims.create({
        key: s + '-run',
        frames: ['run1', 'run2', 'run3', 'run4'].map((p) => ({ key: s + '-' + p })),
        frameRate: 12,
        repeat: -1,
      });
    }
  }

  makeWorldRect(x, y, w, h, color, group) {
    const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, color);
    group.add(rect); // Physics-Group aktiviert den Body und wendet die Group-Defaults an
    rect.body.setVelocityX(-this.speed);
    return rect;
  }

  // Sprite mit Boden-Anker (origin 0.5/1) + Hitbox kleiner als das Visual
  makeWorldSprite(cx, bottomY, key, group, bodyW, bodyH) {
    const s = this.add.sprite(cx, bottomY, key).setOrigin(0.5, 1).setDepth(5);
    group.add(s);
    s.body.setSize(bodyW, bodyH);
    s.body.setOffset((s.width - bodyW) / 2, s.height - bodyH);
    s.body.setVelocityX(-this.speed);
    return s;
  }

  makeGround(x, w, crumble) {
    const h = CFG.H - CFG.GROUND_Y;
    const g = this.add.tileSprite(x + w / 2, CFG.GROUND_Y + h / 2, w, h, crumble ? 'crumbleTex' : 'roof').setDepth(4);
    this.groundGroup.add(g);
    g.tilePositionX = x % 96; // Muster weltfest, damit Nahtstellen nicht springen
    g.body.setVelocityX(-this.speed);
    g.body.friction.x = 0; // Boden zieht Spieler nicht mit nach links
    g.isCrumble = !!crumble;
    g.isGround = true;
    return g;
  }

  makeCell(x, y) {
    const c = this.add.sprite(x, y, 'cell').setDepth(5);
    this.cellGroup.add(c);
    c.body.setSize(11, 11);
    c.body.setOffset(-1.5, -1.5); // Pickup-Hitbox großzügiger als das Visual
    c.body.setVelocityX(-this.speed);
    c.isCell = true;
    this.tweens.add({ targets: c, alpha: 0.65, duration: 300 + (x % 200), yoyo: true, repeat: -1 });
    return c;
  }

  makePU(x, y, type) {
    const pu = this.add.sprite(x, y, 'pu-' + type).setDepth(5);
    this.puGroup.add(pu);
    pu.body.setSize(16, 16);
    pu.body.setOffset(-2, -2);
    pu.body.setVelocityX(-this.speed);
    pu.puType = type;
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
    // Balancing: erste 60 s leicht — Stufe 1 bis 25 s, Stufe 2 bis 60 s, dann alles
    const maxDiff = this.elapsed < 25000 ? 1 : (this.elapsed < 60000 ? 2 : 3);
    const pool = CHUNKS.filter((c) => c.difficulty <= maxDiff && c.id !== this.lastChunkId);
    return Phaser.Utils.Array.GetRandom(pool.length ? pool : CHUNKS);
  }

  // ---------- Input ----------

  onJumpPressed() {
    if (this.dead) { this.tryRestart(); return; }
    this.jumpHeld = true;
    this.jumpBufferedAt = this.time.now;
    // Audio NACH der Input-Logik — ein Audio-Problem darf nie einen Sprung fressen
    AudioSys.ensure();
    AudioSys.startMusic();
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
      AudioSys.ui();
      this.toast(s.name + ' aktiviert', '#c8d6ff');
    } else {
      this.toast(s.name + ' gesperrt — ' + s.cost + '⚡ nötig', '#ff8c8c');
    }
  }

  // ---------- Sammeln ----------

  collectCell(cell) {
    if (this.dead) return;
    // Pitch-Ladder: Kette steigt pro Zelle, Reset bei Lücke
    if (this.time.now - this.lastCellAt > 1500) this.cellChain = 0;
    this.lastCellAt = this.time.now;
    AudioSys.cell(this.cellChain);
    this.cellChain += 1;
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
    const puCols = { magnet: CFG.COL.magnet, shield: CFG.COL.shield, x2: CFG.COL.x2, od: CFG.COL.overdrive };
    this.burst(pu.x, pu.y, puCols[type], 12);
    pu.destroy();
    if (type !== 'od') {
      AudioSys.powerup();
      this.flash();
    }
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
    this.odBar.setVisible(true);
    this.toast('OVERDRIVE!', '#ff8c42');
    AudioSys.odStart();
    AudioSys.setOverdrive(true);
    this.addTrauma(0.5);
    this.checkMissions();
  }

  endOverdrive() {
    this.odActive = false;
    this.playerSpr.setAlpha(1);
    this.odBar.setVisible(false);
    this.invulnUntil = this.time.now + 600; // kurze Schonfrist nach Modus-Ende
    AudioSys.odEnd();
    AudioSys.setOverdrive(false);
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
      AudioSys.hit();
      this.hitStop(45);
      this.addTrauma(0.4);
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
      AudioSys.shieldPop();
      this.hitStop(45);
      this.addTrauma(0.35);
      this.flash(0x6ee787);
      return;
    }
    this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deathAt = this.time.now;
    if (this.sliding) AudioSys.slideStop();
    if (this.odActive) AudioSys.setOverdrive(false);

    // Tod-Sequenz (Konzept 2.6/8): Hit-Stop → Slow-Mo 0,2× → Desaturierung → Knock-back-Bogen
    AudioSys.hit();
    AudioSys.death();
    AudioSys.duck(true);
    this.addTrauma(0.7);
    this.cameras.main.flash(90, 255, 255, 255);
    this.playerSpr.anims.stop();
    this.playerSpr.setTexture(this.skin.id + '-death').setAlpha(1);
    this.physics.world.timeScale = 60; // Hit-Stop
    this.time.delayedCall(60, () => { if (this.dead) this.physics.world.timeScale = 5; }); // Slow-Mo 0,2×
    this.desat = this.add.rectangle(CFG.W / 2, CFG.H / 2, CFG.W, CFG.H, 0x40445c, 0.45).setDepth(8.5);
    const body = this.player.body;
    body.checkCollision.none = true;
    body.setVelocity(-50, -260);
    body.setGravityY(CFG.GRAV_DOWN);

    // Persistenz + Missionen
    const dist = Math.floor(this.distance);
    this.stats.runDist = dist;
    const isBest = dist > Save.data.best;
    if (isBest) Save.data.best = dist;
    Save.data.totalRuns += 1;
    const completed = Missions.check(this.stats);
    Save.persist();

    this.time.delayedCall(620, () => {
      this.physics.pause();
      this.physics.world.timeScale = 1;
      this.showGameOver(isBest, completed);
    });
  }

  showGameOver(isBest, completed) {
    const dist = this.stats.runDist;
    const score = Math.floor(this.distance) + this.cellScore;
    const lines = [
      '',
      dist + ' m' + (isBest ? ' ★ NEU' : ''),
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

    this.overlay = this.add.text(CFG.W / 2, CFG.H / 2 + 14, lines.join('\n'), {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(20);

    // Share-Button + OsAI-Credit (Footer des Game-Over-Screens)
    const shareBtn = this.add.text(CFG.W / 2 - 70, CFG.H - 10, '[ SCORE TEILEN ]', {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffd24a', fontStyle: 'bold',
    }).setOrigin(0.5, 1).setDepth(20).setInteractive({ useHandCursor: true });
    shareBtn.on('pointerdown', (p, lx, ly, ev) => {
      ev.stopPropagation();
      const txt = score + ' Punkte bei NEON DASH' + (this.lastRank ? ' (Platz ' + this.lastRank + ')' : '')
        + ' — schlag das: https://neon-dash.demo.osai.solutions';
      AudioSys.ui();
      if (navigator.share) {
        navigator.share({ text: txt }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(() => this.toast('KOPIERT — einfach posten!', '#ffd24a')).catch(() => {});
      }
    });
    const credit = this.add.text(CFG.W / 2 + 88, CFG.H - 10, 'GEBAUT VON OsAI ↗', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8a8aa8',
    }).setOrigin(0.5, 1).setDepth(20).setInteractive({ useHandCursor: true });
    credit.on('pointerdown', (p, lx, ly, ev) => {
      ev.stopPropagation();
      window.open('https://osai.solutions?utm_source=neon-dash', '_blank');
    });

    // Score-Tally mit Count-up (snappt nie)
    const tally = this.add.text(CFG.W / 2, CFG.H / 2 - 52, 'SCORE 0', {
      fontFamily: 'monospace', fontSize: '18px', color: '#41f6f6', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(20);
    this.tweens.addCounter({
      from: 0, to: score, duration: 700, ease: 'Cubic.easeOut',
      onUpdate: (tw) => tally.setText('SCORE ' + Math.floor(tw.getValue())),
    });
    if (isBest && dist > 0) AudioSys.fanfare();
    this.handleLeaderboard(score, dist);
  }

  // Bestenliste: Name einmalig erfragen, danach Auto-Submit + Platz-Anzeige
  handleLeaderboard(score, dist) {
    if (score < 50) return; // Mini-Runs nicht nerven
    const showRank = (r) => {
      if (!r || !this.dead || !this.overlay) return;
      const txt = r.improved
        ? '★ PLATZ ' + r.rank + ' VON ' + r.count + ' ★'
        : 'PLATZ ' + r.rank + ' VON ' + r.count + ' (Best: ' + r.best + ')';
      this.lastRank = r.rank;
      this.add.text(CFG.W / 2, CFG.H / 2 - 32, txt, {
        fontFamily: 'monospace', fontSize: '11px', color: r.improved ? '#ffd24a' : '#8a8aa8', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(20);
      if (r.improved && r.rank <= 10) this.burst(CFG.W / 2, CFG.H / 2 - 32, 0xffd24a, 14);
    };
    if (LB.name) {
      LB.submit(score, dist).then(showRank);
      return;
    }
    if (window._lbSkipped) return; // „Später" gilt für die ganze Session
    this.input.keyboard.enabled = false; // Tippen darf keinen Restart auslösen
    showNameInput((name) => {
      this.input.keyboard.enabled = true;
      this.deathAt = this.time.now; // Restart-Lockout neu, falls Enter durchrutscht
      if (name) {
        LB.setName(name);
        LB.submit(score, dist).then(showRank);
      } else {
        window._lbSkipped = true;
      }
    });
  }

  tryRestart() {
    // 250 ms Lockout, damit ein gehaltener Sprung-Input nicht sofort neu startet
    if (this.time.now - this.deathAt > 250) {
      AudioSys.ui();
      AudioSys.duck(false);
      this.scene.restart();
    }
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
    AudioSys.milestone();
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
    AudioSys.nearmiss();
    this.addTrauma(0.12);
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
    const dt = delta / 1000;
    if (this.dead) {
      // Knock-back-Bogen weiterzeichnen + Shake ausklingen lassen
      this.updateShake(dt);
      const b = this.player.body;
      this.playerSpr.setPosition(Math.round(b.center.x), Math.round(b.bottom));
      return;
    }
    this.elapsed += delta;

    // Speed-Ramp mit Plateaus, Cap bei 90 s; OVERDRIVE +30 %
    const steps = Math.floor(this.elapsed / CFG.SPEED_STEP_MS);
    this.speedBase = Math.min(CFG.SPEED_START + steps * CFG.SPEED_STEP, CFG.SPEED_MAX);
    this.speed = this.speedBase * (this.odActive ? CFG.OVERDRIVE_SPEED_MULT : 1);
    this.distance += (this.speed * dt) / CFG.PX_PER_M;

    // Welt scrollt — Spawn-Cursor wandert mit
    this.spawnX -= this.speed * dt;
    while (this.spawnX < CFG.W + 250) this.spawnChunk(this.pickChunk());

    // Parallax
    for (let i = 0; i < this.bgLayers.length; i++) {
      this.bgLayers[i].tilePositionX += this.speed * dt * this.bgSpeeds[i];
    }

    this.syncWorld(dt);
    Traps.update(this, time, dt);
    this.updatePlayer(time, dt);
    if (this.dead) return; // Tod innerhalb updatePlayer
    this.updatePowerups(time);
    this.updateScoring(time);
    this.updateHud(time);
    this.updateShake(dt);

    // Speed-Lines am Bildschirmrand bei hohem Tempo
    if (this.speed > 270 && time - this.lastSpeedLineAt > 120) {
      this.lastSpeedLineAt = time;
      const y = 24 + Math.random() * 190;
      const line = this.add.rectangle(CFG.W + 12, y, 16, 1, 0xffffff, 0.3).setDepth(7);
      this.tweens.add({ targets: line, x: -20, duration: 320, ease: 'Linear', onComplete: () => line.destroy() });
    }
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
    if (body.velocity.y > 40) this.lastFallV = body.velocity.y;
    if (grounded) {
      this.lastGroundedAt = time;
      this.jumpsUsed = 0;
      // Landung: Wolke + Squash + Thud, skaliert mit Fallhöhe
      if (!this.wasGrounded && !this.odActive) {
        const force = Math.min(this.lastFallV / CFG.MAX_FALL, 1);
        AudioSys.land(force);
        this.squash(1.28, 0.74);
        this.dust(this.player.x, CFG.GROUND_Y, Math.round(3 + force * 7));
        this.lastFallV = 0;
      }
      // Lauf-Staub hinter den Füßen
      if (!this.sliding && time - this.lastDustAt > 110) {
        this.lastDustAt = time;
        this.dust(this.player.x - 7, CFG.GROUND_Y, 1);
      }
    }
    this.wasGrounded = grounded;

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
          // ≥3 Kanäle: Audio + Stretch + Staub
          AudioSys.jump();
          this.squash(0.78, 1.24);
          this.dust(this.player.x, CFG.GROUND_Y, 5);
        } else if (this.jumpsUsed < 2) {
          this.doJump(CFG.DJUMP_VEL);
          this.jumpsUsed = 2;
          AudioSys.djump();
          this.squash(0.8, 1.2);
          this.burst(this.player.x, this.player.body.bottom, 0x41f6f6, 7);
        }
      }

      // Slide: nur am Boden, Hitbox flacher
      const wantSlide = this.keysDown.down.isDown || this.keysDown.s.isDown || this.touchSlide;
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

    // Pose-Sprite folgt dem Physik-Puppet (in Game-Pixeln gerundet)
    const spr = this.playerSpr;
    spr.setPosition(Math.round(body.center.x), Math.round(body.bottom));
    const pre = this.skin.id;
    if (this.odActive) {
      spr.anims.stop();
      spr.setTexture(pre + '-fly');
    } else if (this.sliding) {
      spr.anims.stop();
      spr.setTexture(pre + '-slide');
    } else if (!grounded) {
      spr.anims.stop();
      spr.setTexture(pre + '-jump');
    } else {
      spr.play(pre + '-run', true);
    }
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
        // letzte 2 s: Warn-Blinken + Ticken
        if (left < CFG.OVERDRIVE_WARN_MS) {
          this.playerSpr.setAlpha(Math.floor(time / 110) % 2 === 0 ? 0.5 : 1);
          if (time - this.lastOdTickAt > 250) {
            this.lastOdTickAt = time;
            AudioSys.odTick();
          }
        }
        // Motion-Trail während OVERDRIVE
        if (time - this.lastTrailAt > 50) {
          this.lastTrailAt = time;
          const ghost = this.add.image(this.playerSpr.x, this.playerSpr.y, this.playerSpr.texture.key)
            .setOrigin(0.5, 1).setDepth(5.5).setTint(0xffa040).setAlpha(0.35);
          this.tweens.add({ targets: ghost, alpha: 0, x: ghost.x - 18, duration: 300, onComplete: () => ghost.destroy() });
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
        AudioSys.fanfare();
        this.addTrauma(0.25);
      } else if (gx < CFG.W + 10) {
        this.ghostLine.setPosition(gx, CFG.H / 2 + 20).setVisible(true);
        this.ghostLabel.setPosition(gx, 56).setVisible(true);
      }
    }

    // Paletten-Swap Abend→Nacht→Dämmerung alle 500 m (Farb-Grading über den Bild-Layern)
    const pi = (1 + Math.floor(this.distance / CFG.PALETTE_M)) % CFG.PALETTES.length;
    if (pi !== this.paletteIdx) {
      this.paletteIdx = pi;
      const grade = [
        { color: 0xff2079, alpha: 0.07 }, // Abend: pinker Schimmer
        { color: 0x000000, alpha: 0 },    // Nacht: neutral
        { color: 0xff8c42, alpha: 0.09 }, // Dämmerung: warmer Schimmer
      ][pi];
      this.gradeOverlay.setFillStyle(grade.color, this.gradeOverlay.fillAlpha);
      this.tweens.add({ targets: this.gradeOverlay, fillAlpha: grade.alpha, duration: 1500 });
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
    AudioSys.slideStart();
    this.squash(1.25, 0.7);
    this.dust(this.player.x - 6, CFG.GROUND_Y, 4);
  }

  endSlide() {
    if (!this.sliding) return;
    this.sliding = false;
    const p = CFG.PLAYER;
    this.player.body.setSize(p.hitW, p.hitH);
    this.player.body.setOffset((p.drawW - p.hitW) / 2, p.drawH - p.hitH);
    AudioSys.slideStop();
  }

  // ---------- Juice-Helfer (Konzept 2.6) ----------

  // Squash & Stretch: Sprite-Skalierung federt zurück
  squash(sx, sy) {
    this.playerSpr.setScale(sx, sy);
    this.tweens.add({ targets: this.playerSpr, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.easeOut' });
  }

  // 1–2 Frames Weiß-Flash auf dem Helden
  flash(color = 0xffffff) {
    this.playerSpr.setTintFill(color);
    this.time.delayedCall(50, () => { if (!this.dead) this.playerSpr.clearTint(); });
  }

  // Hit-Stop: 2–4 Frames Freeze
  hitStop(ms = 55) {
    this.physics.world.timeScale = 60;
    this.time.delayedCall(ms, () => { this.physics.world.timeScale = this.dead ? 5 : 1; });
  }

  // trauma-basierter Shake, in Game-Pixeln gerundet (sonst Blur)
  addTrauma(amount) {
    this.trauma = Math.min(this.trauma + amount, 1);
  }

  updateShake(dt) {
    if (this.trauma <= 0) {
      this.cameras.main.setScroll(0, 0);
      return;
    }
    this.trauma = Math.max(this.trauma - dt * 1.6, 0);
    const mag = this.trauma * this.trauma * 6;
    this.cameras.main.setScroll(
      Math.round((Math.random() * 2 - 1) * mag),
      Math.round((Math.random() * 2 - 1) * mag)
    );
  }

  // Lauf-Staub / Lande-Wolke
  dust(x, y, count) {
    const em = this.add.particles(x, y, 'px', {
      speed: { min: 15, max: 50 }, angle: { min: 200, max: 340 }, lifespan: 350,
      scale: { start: 1.2, end: 0 }, tint: 0x8a8aa8, emitting: false,
    }).setDepth(5);
    em.explode(count);
    this.time.delayedCall(420, () => em.destroy());
  }
}

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  width: CFG.W,
  height: CFG.H,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#1a1c2c',
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scale: {
    mode: Phaser.Scale.NONE,
    zoom: Phaser.Scale.MAX_ZOOM, // Integer-Scaling
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TitleScene, GameScene],
});

// Integer-Zoom-Fit bei Resize/Rotation; unter 1× (Mobile portrait) fraktional auf Breite
function fitZoom() {
  const z = Math.min(window.innerWidth / CFG.W, window.innerHeight / CFG.H);
  window.game.scale.setZoom(z >= 1 ? Math.floor(z) : Math.max(z, 0.4));
}
window.addEventListener('resize', () => setTimeout(fitZoom, 50));
window.game.events.once('ready', fitZoom);
