// NEON DASH — Fallen-Fabrik + Telegraphing (Konzept 2.3)
// Alle Fallen leben im obstacleGroup (Berührung = Hit). Telegraphing pro Typ:
// bar/wall flackern, Drohnen blinken 0,7 s vor Ankunft rot, Laser kündigt sich
// per Warn-Icon am rechten Bildschirmrand an, Bröckel-Plattformen wackeln beim Betreten.
// Sprites mit Hitbox KLEINER als das Visual (Fairness-Pflicht).

const Traps = {
  create(scene, type, x) {
    let o = null;
    switch (type) {
      case 'block': // Lüftungs-Box auf dem Dach → Jump
        o = scene.makeWorldSprite(x + 8, CFG.GROUND_Y, 'block', scene.obstacleGroup, 11, 18);
        break;
      case 'bar': { // niedrige Strom-Barriere → Slide (Slide-Hitbox 220–230 kommt durch)
        o = scene.makeWorldSprite(x + 23, 218, 'bar', scene.obstacleGroup, 38, 5);
        scene.tweens.add({ targets: o, alpha: 0.55, duration: 90, yoyo: true, repeat: -1 });
        break;
      }
      case 'wall': // hohe Strom-Barriere → Jump
        o = scene.makeWorldSprite(x + 6, CFG.GROUND_Y, 'wall', scene.obstacleGroup, 6, 31);
        scene.tweens.add({ targets: o, alpha: 0.55, duration: 110, yoyo: true, repeat: -1 });
        break;
      case 'drone-low': // Flughöhe Kopf → Jump ODER Slide
        o = this.drone(scene, x, 211);
        break;
      case 'drone-high': // Flughöhe Sprung-Apex → NICHT springen
        o = this.drone(scene, x, 186);
        break;
      case 'laser': // vertikal wandernder Laser → Timing-Jump
        o = this.laser(scene, x);
        break;
    }
    if (o) o.trapType = type;
    return o;
  },

  drone(scene, x, y) {
    const o = scene.makeWorldSprite(x, y + 6, 'drone', scene.obstacleGroup, 18, 9);
    o.baseY = y;
    o.bobPhase = (x % 100) / 100 * Math.PI * 2;
    o.blinkOn = false;
    // Blink-Licht als Kind-Visual
    o.lamp = scene.add.rectangle(o.x, o.y - 9, 4, 4, 0x8a8aa8).setDepth(6);
    return o;
  },

  laser(scene, x) {
    // Emitter-Pylon (rein visuell, scrollt mit) + oszillierender Beam (tödlich)
    const midY = (CFG.LASER_HI_Y + CFG.LASER_LO_Y) / 2;
    const beam = scene.makeWorldRect(x - 28, midY - 2, 60, 4, CFG.COL.laser, scene.obstacleGroup);
    beam.body.setSize(56, 3);
    beam.body.setOffset(2, 0);
    beam.isLaser = true;
    beam.phase = 0;
    beam.warned = false;
    beam.pylon = scene.add.sprite(x + 4, CFG.GROUND_Y, 'pylon').setOrigin(0.5, 1).setDepth(4);
    scene.tweens.add({ targets: beam, alpha: 0.7, duration: 70, yoyo: true, repeat: -1 });
    return beam;
  },

  // pro Frame: Bob, Blink, Beam-Oszillation, Laser-Warn-Icon
  update(scene, time, dt) {
    const speed = scene.speed;
    scene.obstacleGroup.children.iterate((o) => {
      if (!o) return;
      if (o.trapType === 'drone-low' || o.trapType === 'drone-high') {
        o.bobPhase += dt * 4;
        o.body.setVelocityY(Math.sin(o.bobPhase) * 9);
        o.lamp.setPosition(o.x, o.y - 9);
        // rotes Blinken, wenn die Drohne ~0,7 s vor dem Spieler ist
        const eta = (o.x - scene.player.x) / Math.max(speed, 1);
        if (eta > 0 && eta < CFG.DRONE_BLINK_S) {
          o.blinkOn = Math.floor(time / 100) % 2 === 0;
          o.lamp.setFillStyle(o.blinkOn ? CFG.COL.droneBlink : 0x8a8aa8);
          o.setTint(o.blinkOn ? 0xff8080 : 0xffffff);
        } else if (o.blinkOn) {
          o.blinkOn = false;
          o.lamp.setFillStyle(0x8a8aa8);
          o.clearTint();
        }
      } else if (o.isLaser) {
        // Beam wandert sinusförmig zwischen HI und LO (velocity-basiert, bleibt physik-sauber)
        o.phase += (dt * 1000) / CFG.LASER_PERIOD_MS * Math.PI * 2;
        const mid = (CFG.LASER_HI_Y + CFG.LASER_LO_Y) / 2;
        const amp = (CFG.LASER_LO_Y - CFG.LASER_HI_Y) / 2;
        const targetY = mid + Math.sin(o.phase) * amp;
        // geclampt, damit dt-Spikes den Beam nicht aus der Welt schießen
        const vy = Phaser.Math.Clamp((targetY - o.y) / Math.max(dt, 1 / 120), -130, 130);
        o.body.setVelocityY(vy);
        o.pylon.x = o.x + 32;
        // Warn-Icon am rechten Rand, ~1 s bevor der Laser den Screen erreicht (Jetpack-Joyride-Pattern)
        const eta = (o.x - 30 - CFG.W) / Math.max(speed, 1);
        if (!o.warned && eta > 0 && eta < 1.0) {
          o.warned = true;
          const warn = scene.add.text(CFG.W - 14, mid - 8, '!', {
            fontFamily: 'monospace', fontSize: '16px', color: '#ff4040', fontStyle: 'bold',
          }).setDepth(15);
          scene.tweens.add({
            targets: warn, alpha: 0, duration: 160, yoyo: true, repeat: 5,
            onComplete: () => warn.destroy(),
          });
        }
      }
    });
  },

  // Visual-Anhängsel einer Falle mit zerstören
  destroyExtras(o) {
    if (o.lamp) o.lamp.destroy();
    if (o.pylon) o.pylon.destroy();
  },

  // Bröckel-Plattform: wackelt + fällt nach CRUMBLE_MS (Aufruf aus dem Boden-Collider)
  triggerCrumble(scene, plat) {
    if (plat.crumbling) return;
    plat.crumbling = true;
    scene.tweens.add({ targets: plat, y: '+=1.5', duration: 50, yoyo: true, repeat: -1 });
    scene.time.delayedCall(CFG.CRUMBLE_MS, () => {
      if (!plat.body) return;
      plat.body.setAllowGravity(true);
      plat.body.setImmovable(false);
      plat.body.checkCollision.none = true; // trägt nicht mehr
      plat.body.setGravityY(700);
      scene.tweens.add({ targets: plat, alpha: 0.6, duration: 300 });
    });
  },
};
