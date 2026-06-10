# NEON DASH

Ein-Knopf-Endless-Runner im Pixel-Style: Roboter **Volt** rennt über die Neon-Dächer
einer Cyberpunk-Stadt. Statische Site — Phaser 3 via CDN, kein Build-Step, kein Backend.

**Live:** https://neon-dash.demo.osai.solutions

## Steuerung

| Input | Aktion |
|---|---|
| Space / Tap | Sprung (2. Druck in der Luft = Doppelsprung) |
| ↓ / S / unteres Screen-Band halten | Slide |
| 1 / 2 / 3 | Skin wählen (VOLT · BLAZE · ORI) |

## Features

- 6 Fallentypen mit Telegraphing, 16 handgebaute Pattern-Chunks
- 4 Power-ups: Magnet, Schild, ×2, **OVERDRIVE** (Hold-to-fly, Screen-Clear, Coin-Regen)
- Combo + Near-Miss-Boni, Meilensteine, Bestmarken-Geist, 12 rotierende Missionen
- Coyote-Time 90 ms, Input-Buffer 100 ms, 2× Fall-Gravitation, Hitboxen < Sprites
- Prozeduraler Chiptune-Synth (16 SFX) + Suno-Synthwave-Loop mit OVERDRIVE-Filter
- AI-Pixel-Art-Pipeline: GPT Image 2 + Nano Banana 2 → Point-Downscale → Palette-Remap → Magenta-Key

## Lokal starten

```bash
python3 -m http.server 8765
# http://localhost:8765
```

## Struktur

```
index.html          Einstieg (lädt Phaser via CDN)
js/                 config · audio · systems · traps · chunks · title · game
assets/sprites/     Held (3 Skins × 8 Posen), Fallen, Pickups
assets/layers/      4 Parallax-Layer + Dach-Tiles
assets/audio/       Suno-Loop (SFX sind prozedural)
tools/              gen.sh (GPT Image 2) · nb.sh (Nano Banana 2) · pixelize.py · recolor.py · sfx.sh
```

Konzept & Bauplan: `agent-studio/.planning/pixel-runner/CONCEPT.md`

---
Gebaut von [OsAI](https://osai.solutions) · Phaser 3 · GPT Image 2 · Nano Banana 2 · Suno
