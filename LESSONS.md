# Lessons — NEON DASH Build (2026-06-10)

Erkenntnisse aus dem autonomen Build, wiederverwendbar für künftige Game-/Pixel-Art-Projekte.

## Phaser 3
- **Physics-Group-Defaults schlagen Body-Props.** `group.add(gameObject)` wendet die Group-Defaults
  (`allowGravity`, `immovable`, Velocity) an und überschreibt vorher gesetzte Body-Werte.
  Defaults IMMER in der Group-Config setzen, nie nachträglich am Body vor dem `add()`.
- **Physik-Puppet-Pattern:** unsichtbares Rechteck trägt den getunten Arcade-Body, der Pose-Sprite
  folgt per `setPosition(round(body.center.x), round(body.bottom))`. Sprite-Wechsel (verschiedene
  Frame-Größen) ohne jedes Hitbox-Gefummel.
- **Velocity-getriebene Oszillation clampen** (`(target-y)/max(dt,1/120)` + Clamp), sonst schießen
  dt-Spikes Objekte aus der Welt.
- Integer-Scaling: `Scale.NONE` + `zoom: MAX_ZOOM` + eigener `resize`-Listener (`floor(min(w/W,h/H))`,
  unter 1 fraktional für Mobile portrait).

## AI-Pixel-Art-Pipeline (bestätigt + verfeinert)
- Konzept-2.9-Kette funktioniert: Magenta-BG generieren → **NEAREST aufs ECHTE Display-Grid**
  (nicht 64px wenn das Sprite 24px gezeigt wird — non-integer Downscale im Engine = Mush) →
  16-Farben-Remap ohne Dither → Magenta-Key (fuzz 16 % lässt #ff2079-Pink unbeschadet).
- Pillow ersetzt ImageMagick 1:1 (`Resampling.NEAREST`, `quantize(palette, Dither.NONE)`).
- **Held zuerst, dann alles per Nano-Banana-i2i mit Held als Ref** — Stil blieb über 20+ Assets stabil.
- Skin-Varianten als Palette-LUT-Swap in Pillow: 0 €, 1 s, konsistent.
- Parallax-Layer einzeln generieren mit „Rand frei lassen"-Anweisung → trivial kachelbar.
- Hintergrund-Layer brauchen **Distanz-Dimming** (Tint + Alpha + dunkles Lauf-Band), sonst
  erschlägt die Stadt das Spielfeld.

## Audio
- **Kie→ElevenLabs-SFX-Bridge war down** (bekannter Ausfall seit 2026-04-30) → prozeduraler
  WebAudio-Chiptune-Synth als Fallback ist für Arcade-SFX sogar die bessere Wahl:
  0 €, 0 ms Latenz, Pitch-Ladder = `rate`-Mathe statt 14 Dateien.
- Musik über eigenes WebAudio-Graph (MediaElement → BiquadFilter → Gain) statt Phaser-Sound:
  OVERDRIVE-Lowpass-Öffnung, Pitch +5 %, Tod-Ducking — alles 5 Zeilen.
- `AudioSys.ensure()` NIE als erste Zeile im Input-Handler — Audio-Fehler dürfen keinen Sprung fressen.

## Playwright-Spieltests
- `page.evaluate("window.x = <GameObject>")` als letzten Ausdruck vermeiden — Playwright
  versucht zyklische Phaser-Objekte zu serialisieren; Folge sind Heisenbugs. `; 1` anhängen.
- Spieler für deterministische Systemtests **mid-air** einfrieren (`body.moves=false` + y hoch),
  sonst schieben hereinscrollende Boden-Segmente ihn per Ecken-Kollision in den Crush-Tod.
- Treffer-Tests direkt über `scene.onHit(obstacle)` injizieren statt Scroll-Timing zu raten.

## Kosten (Ist)
| Posten | Menge | Ist |
|---|---|---|
| GPT Image 2 + Nano Banana 2 | 25 Renders | 1,24 € |
| Suno (Musik, 2 Varianten) | 1 Call | 0,20 € |
| SFX | prozedural | 0,00 € |
| **Gesamt** | | **1,44 €** (Budget ~10 €, Konzept-Schätzung 7–9 €) |

1K-Auflösung statt 2K war der Hebel: Sprites werden eh aufs Grid runtergerechnet.
