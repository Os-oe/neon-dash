// NEON DASH — Title-Screen (nur beim ersten Laden; Restart geht direkt in den Run)
class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  preload() {
    // gleiche Assets wie GameScene — der Loader überspringt bereits geladene Keys
    GameScene.prototype.preload.call(this);
  }

  create() {
    Save.load();
    const layers = ['sky', 'far', 'near', 'signs'];
    const tints = [0xffffff, 0x6a6a92, 0x9090b8, 0xb8b8d0];
    this.bg = layers.map((key, i) =>
      this.add.tileSprite(CFG.W / 2, CFG.H / 2, CFG.W, CFG.H, key).setDepth(i).setTint(tints[i])
    );
    this.add.rectangle(CFG.W / 2, CFG.H / 2, CFG.W, CFG.H, 0x0b0b12, 0.35).setDepth(4);

    const logo = this.add.image(CFG.W / 2, 86, 'logo').setDepth(10);
    this.tweens.add({ targets: logo, y: 90, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Held läuft auf dem Dach
    this.roof = this.add.tileSprite(CFG.W / 2, CFG.GROUND_Y + 20, CFG.W, 40, 'roof').setDepth(5);
    this.hero = this.add.sprite(CFG.W / 2, CFG.GROUND_Y, Skins.active().id + '-run1').setOrigin(0.5, 1).setDepth(6);
    GameScene.prototype.makeAnims.call(this);
    this.hero.play(Skins.active().id + '-run');

    const style = { fontFamily: 'monospace', fontSize: '11px', color: '#c8d6ff', align: 'center' };
    this.add.text(CFG.W / 2, 158, 'SPACE / TAP = START', { ...style, fontSize: '13px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(10).setAlpha(1);
    const hint = this.add.text(CFG.W / 2, 178, 'Sprung: SPACE · Doppelsprung: 2× · Slide: ↓ / unten halten', style)
      .setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: hint, alpha: 0.5, duration: 700, yoyo: true, repeat: -1 });

    if (Save.data.best > 0) {
      this.add.text(CFG.W / 2, 196, 'BEST ' + Save.data.best + ' m   ·   ⚡' + Save.data.totalCells, { ...style, color: '#ffd24a' })
        .setOrigin(0.5).setDepth(10);
    }
    this.skinText = this.add.text(CFG.W / 2, 250, '', { ...style, fontSize: '9px' }).setOrigin(0.5).setDepth(10);
    this.renderSkinLine();

    const start = () => {
      AudioSys.ensure();
      AudioSys.startMusic();
      AudioSys.ui();
      this.scene.start('game');
    };
    this.input.keyboard.on('keydown-SPACE', start);
    this.input.keyboard.on('keydown-UP', start);
    this.input.on('pointerdown', start);
    for (const [key, idx] of [['ONE', 0], ['TWO', 1], ['THREE', 2]]) {
      this.input.keyboard.on('keydown-' + key, () => {
        if (Skins.select(SKINS[idx].id)) {
          AudioSys.ui();
          this.hero.play(SKINS[idx].id + '-run');
        }
        this.renderSkinLine();
      });
    }
  }

  renderSkinLine() {
    this.skinText.setText(SKINS.map((s, i) => {
      const tag = Skins.unlocked(s) ? s.name : s.name + '(' + s.cost + '⚡)';
      return (s.id === Save.data.activeSkin ? '[' + (i + 1) + ']▸' : '[' + (i + 1) + '] ') + tag;
    }).join('   '));
  }

  update(time, delta) {
    const dt = delta / 1000;
    const speeds = [0.03, 0.12, 0.28, 0.55];
    this.bg.forEach((l, i) => { l.tilePositionX += 140 * dt * speeds[i]; });
    this.roof.tilePositionX += 140 * dt;
  }
}
