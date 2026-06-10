#!/usr/bin/env python3
"""Nimmt 3 Gameplay-Segmente für das LinkedIn-Video auf (Playwright video capture).

Der Bot spielt ECHT (kein Invuln): liest Fallen + Lücken voraus und reagiert —
Tode sind erlaubt und sogar erwünscht (Segment C zeigt Tod → Instant-Restart).
"""
import sys
from playwright.sync_api import sync_playwright

G = "window.game.scene.getScene('game')"
URL = 'http://localhost:8765'

BOT_JS = """
window._bot = setInterval(() => {
  const sc = window.game.scene.getScene('game');
  if (!sc || !sc.player || sc.dead || !sc.player.body) return;
  const px = sc.player.x;
  const speed = sc.speed;
  const look = speed * 0.42 + 30;
  let jump = false, slide = false;

  sc.obstacleGroup.children.iterate(o => {
    if (!o || !o.body) return;
    const dx = o.x - px;
    if (dx < 8 || dx > look) return;
    const t = o.trapType;
    if (t === 'bar' || t === 'drone-low') slide = true;
    else if (t === 'block' || t === 'wall') jump = true;
    else if (t === 'laser' && o.y > 206) jump = true;
  });

  // Lücken-Check: gibt es Boden kurz vor uns?
  const probe = px + speed * 0.30;
  let groundAhead = false;
  sc.groundGroup.children.iterate(g => {
    if (!g || !g.body || g.body.checkCollision.none) return;
    if (probe >= g.x - g.width / 2 && probe <= g.x + g.width / 2) groundAhead = true;
  });
  const grounded = sc.player.body.blocked.down || sc.player.body.touching.down;
  if (!groundAhead && grounded) jump = true;

  if (jump && !sc.jumpHeld) {
    sc.onJumpPressed();
    setTimeout(() => sc.onJumpReleased(), 170);
    // Lücke + kein Boden in Sicht → Double-Jump nachschieben
    if (!groundAhead) setTimeout(() => { sc.onJumpPressed(); setTimeout(() => sc.onJumpReleased(), 150); }, 240);
  }
  sc.touchSlide = slide && !jump;
}, 70);
"""


def new_page(p, browser, name):
    ctx = browser.new_context(
        viewport={'width': 1280, 'height': 720},
        record_video_dir='video/raw',
        record_video_size={'width': 1280, 'height': 720},
    )
    page = ctx.new_page()
    page.goto(URL)
    page.wait_for_timeout(1600)
    return ctx, page


def save(ctx, page, name):
    video = page.video
    ctx.close()
    path = video.path()
    import os
    os.rename(path, f'video/raw/{name}.webm')
    print(f'{name}: video/raw/{name}.webm')


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # SEG A — Title-Screen (Logo wippt) → Start → erste Sprünge
    ctx, page = new_page(p, browser, 'segA')
    page.wait_for_timeout(2800)              # Title wirken lassen
    page.keyboard.press('Space')
    page.evaluate(BOT_JS)
    page.wait_for_timeout(8000)
    save(ctx, page, 'segA')

    # SEG B — Action-Run → OVERDRIVE einsammeln → Flug + Coin-Regen
    ctx, page = new_page(p, browser, 'segB')
    page.keyboard.press('Space')
    page.evaluate(BOT_JS)
    page.wait_for_timeout(7000)
    # OVERDRIVE-Kern direkt vor den Spieler legen (echtes Einsammeln, kein Cheat)
    page.evaluate(f"{G}.makePU({G}.player.x + 260, 200, 'od')")
    page.wait_for_timeout(1400)
    # Flugphase: Bot aus, sanftes Hold-to-fly-Muster
    page.evaluate("clearInterval(window._bot)")
    for i in range(5):
        page.keyboard.down('Space')
        page.wait_for_timeout(420)
        page.keyboard.up('Space')
        page.wait_for_timeout(480)
    page.evaluate(BOT_JS)
    page.wait_for_timeout(2500)
    save(ctx, page, 'segB')

    # SEG C — Tod (Slow-Mo + Tally) → Instant-Restart
    ctx, page = new_page(p, browser, 'segC')
    page.keyboard.press('Space')
    page.evaluate(BOT_JS)
    page.wait_for_timeout(5000)
    page.evaluate("clearInterval(window._bot)")   # Bot aus → nächstes Hindernis trifft
    # warten bis tot (max 8s)
    for i in range(40):
        if page.evaluate(f"{G}.dead"):
            break
        page.wait_for_timeout(200)
    page.wait_for_timeout(1900)                   # Slow-Mo + Score-Tally zeigen
    page.keyboard.press('Space')                  # Instant-Restart
    page.evaluate(BOT_JS)
    page.wait_for_timeout(2600)
    save(ctx, page, 'segC')

    browser.close()
print('done')
