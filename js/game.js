// NEON DASH — Greybox-Kern (Phase 1)
// Spielbarer Kern mit farbigen Rechtecken: Run/Jump/Double-Jump/Slide,
// Coyote-Time, Input-Buffer, Chunk-Spawning, Kollision, Tod, Instant-Restart.

class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  create() {
    this.speed = CFG.SPEED_START;
    this.elapsed = 0;
    this.distance = 0; // in Metern
    this.dead = false;
    this.deathAt = 0;

    // Input-State
    this.jumpBufferedAt = -9999;
    this.lastGroundedAt = -9999;
    this.jumpsUsed = 0;
    this.jumpHeld = false;
    this.sliding = false;

    // Welt-Gruppen: Boden trägt, Hindernisse töten
    this.groundGroup = this.physics.add.group();
    this.obstacleGroup = this.physics.add.group();

    // Spieler
    const p = CFG.PLAYER;
    this.player = this.add.rectangle(p.x, CFG.GROUND_Y - p.drawH / 2, p.drawW, p.drawH, CFG.COL.player);
    this.physics.add.existing(this.player);
    const body = this.player.body;
    body.setSize(p.hitW, p.hitH);
    body.setOffset((p.drawW - p.hitW) / 2, p.drawH - p.hitH);
    body.setMaxVelocityY(CFG.MAX_FALL);

    this.physics.add.collider(this.player, this.groundGroup);
    this.physics.add.overlap(this.player, this.obstacleGroup, () => this.die());

    // Start-Runway, dann Chunks
    this.spawnX = 0;
    this.makeGround(-20, 540); // sicherer Boden unter dem Spieler beim Start
    this.spawnX = 520;
    this.lastChunkId = null;

    // Input — Space/Up/W = Jump, Down/S = Slide, Pointer = Jump (Touch)
    const kb = this.input.keyboard;
    kb.addCapture('SPACE,UP,DOWN');
    this.keysDown = kb.addKeys({ down: 'DOWN', s: 'S' });
    for (const k of ['SPACE', 'UP', 'W']) {
      kb.on('keydown-' + k, (e) => { if (!e.repeat) this.onJumpPressed(); });
      kb.on('keyup-' + k, () => this.onJumpReleased());
    }
    this.input.on('pointerdown', () => this.onJumpPressed());
    this.input.on('pointerup', () => this.onJumpReleased());

    // HUD
    const style = { fontFamily: 'monospace', fontSize: '10px', color: '#c8d6ff' };
    this.distText = this.add.text(6, 5, '0 m', style).setDepth(10);
    this.best = parseInt(localStorage.getItem('neon-dash.best') || '0', 10);
    this.bestText = this.add.text(CFG.W - 6, 5, 'BEST ' + this.best + ' m', style)
      .setOrigin(1, 0).setDepth(10);
    this.overlay = null;
  }

  // ---------- Welt-Bau ----------

  makeWorldRect(x, y, w, h, color, group) {
    const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, color);
    this.physics.add.existing(rect);
    const b = rect.body;
    b.setAllowGravity(false);
    b.setImmovable(true);
    b.setVelocityX(-this.speed);
    group.add(rect);
    return rect;
  }

  makeGround(x, w) {
    const h = CFG.H - CFG.GROUND_Y;
    const g = this.makeWorldRect(x, CFG.GROUND_Y, w, h, CFG.COL.ground, this.groundGroup);
    g.body.friction.x = 0; // Boden zieht Spieler nicht mit nach links
    // Neon-Kante oben (rein visuell, kein Physik-Body)
    const edge = this.add.rectangle(x + w / 2, CFG.GROUND_Y + 1, w, 2, CFG.COL.groundEdge);
    g.edge = edge;
    return g;
  }

  makeObstacle(type, x) {
    if (type === 'block') {
      // Block auf dem Boden → Jump
      return this.makeWorldRect(x, CFG.GROUND_Y - 24, 16, 24, CFG.COL.obstacle, this.obstacleGroup);
    }
    if (type === 'bar') {
      // niedrige Barriere → Slide (Unterkante 218: Stehen kollidiert, Slide-Hitbox 220–230 kommt durch)
      return this.makeWorldRect(x, 212, 46, 6, CFG.COL.obstacle, this.obstacleGroup);
    }
  }

  spawnChunk(chunk) {
    for (const g of chunk.ground) this.makeGround(this.spawnX + g.x, g.w);
    for (const o of chunk.obstacles) this.makeObstacle(o.type, this.spawnX + o.x);
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
    // Jump-Cut: Loslassen während des Steigens kappt den Sprung
    const body = this.player.body;
    if (!this.dead && body.velocity.y < 0) body.setVelocityY(body.velocity.y * CFG.JUMP_CUT);
  }

  doJump(vel) {
    this.player.body.setVelocityY(vel);
    this.jumpBufferedAt = -9999;
    this.lastGroundedAt = -9999;
  }

  // ---------- Tod & Restart ----------

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deathAt = this.time.now;
    this.physics.pause();
    this.player.setFillStyle(CFG.COL.dead);

    const dist = Math.floor(this.distance);
    if (dist > this.best) {
      this.best = dist;
      localStorage.setItem('neon-dash.best', String(dist));
    }
    const msg = 'GAME OVER\n' + dist + ' m' + (dist >= this.best ? '  ★ BEST' : '') + '\n\nSPACE = RESTART';
    this.overlay = this.add.text(CFG.W / 2, CFG.H / 2, msg, {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(20);
  }

  tryRestart() {
    // 250 ms Lockout, damit ein gehaltener Sprung-Input nicht sofort neu startet
    if (this.time.now - this.deathAt > 250) this.scene.restart();
  }

  // ---------- Game-Loop ----------

  update(time, delta) {
    if (this.dead) return;
    const dt = delta / 1000;
    this.elapsed += delta;

    // Speed-Ramp mit Plateaus, Cap bei 90 s
    const steps = Math.floor(this.elapsed / CFG.SPEED_STEP_MS);
    this.speed = Math.min(CFG.SPEED_START + steps * CFG.SPEED_STEP, CFG.SPEED_MAX);
    this.distance += (this.speed * dt) / CFG.PX_PER_M;

    // Welt scrollt — Spawn-Cursor wandert mit
    this.spawnX -= this.speed * dt;
    while (this.spawnX < CFG.W + 250) this.spawnChunk(this.pickChunk());

    // Geschwindigkeit aller Welt-Objekte synchron halten + Offscreen-Cleanup
    for (const grp of [this.groundGroup, this.obstacleGroup]) {
      const trash = [];
      grp.children.iterate((obj) => {
        if (!obj) return;
        obj.body.setVelocityX(-this.speed);
        if (obj.edge) obj.edge.x = obj.x; // Neon-Kante folgt dem Boden-Body
        if (obj.x + obj.width / 2 < -80) trash.push(obj);
      });
      for (const obj of trash) {
        if (obj.edge) obj.edge.destroy();
        grp.remove(obj, true, true);
      }
    }

    const body = this.player.body;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) {
      this.lastGroundedAt = time;
      this.jumpsUsed = 0;
    }

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

    // Spieler-x fixieren (Side-Kollision schiebt sonst nach links)
    if (this.player.x < CFG.PLAYER.x) {
      if (this.player.x < 24) return this.die(); // an einer Wand zerquetscht
      this.player.x = Math.min(this.player.x + 40 * dt, CFG.PLAYER.x);
    }
    body.setVelocityX(0);

    // In die Lücke gefallen
    if (this.player.y > CFG.H + 30) return this.die();

    // HUD
    this.distText.setText(Math.floor(this.distance) + ' m');
  }

  startSlide() {
    this.sliding = true;
    const p = CFG.PLAYER;
    this.player.body.setSize(p.hitW, p.slideH);
    this.player.body.setOffset((p.drawW - p.hitW) / 2, p.drawH - p.slideH);
    this.player.setFillStyle(CFG.COL.playerSlide);
  }

  endSlide() {
    if (!this.sliding) return;
    this.sliding = false;
    const p = CFG.PLAYER;
    this.player.body.setSize(p.hitW, p.hitH);
    this.player.body.setOffset((p.drawW - p.hitW) / 2, p.drawH - p.hitH);
    this.player.setFillStyle(CFG.COL.player);
  }
}

// eslint-disable-next-line no-unused-vars
const game = new Phaser.Game({
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
