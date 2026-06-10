#!/usr/bin/env python3
"""NEON DASH Asset-Pipeline (Konzept 2.9) — Pillow-Port der ImageMagick-Kette.

AI-Output ist *fake* Pixel-Art (1024px, Anti-Aliasing, driftendes Grid).
Dieser Schritt macht echtes Grid daraus:
  downscale: NEAREST-Resize aufs Ziel-Grid   (= magick -filter point -resize)
  remap:     feste Neon-Palette ohne Dither  (= magick +dither -remap)
  key:       Magenta -> Alpha mit Fuzz       (= magick -fuzz 12% -transparent)
  sheet:     Frames horizontal packen        (= magick +append)

Usage:
  pixelize.py sprite  raw.png out.png --size 64x64 [--no-key] [--no-remap] [--trim]
  pixelize.py layer   raw.png out.png --size 480x135 [--key]   # Parallax, default ohne Key
  pixelize.py sheet   out.png f1.png f2.png ...                # Frames packen
"""
import sys
import argparse
from PIL import Image

# Gelockte Neon-Palette (Konzept 2.9) + Schattierungen
PALETTE = [
    (11, 11, 18), (26, 28, 44), (51, 52, 92), (70, 51, 108),
    (90, 90, 134), (138, 138, 168), (200, 214, 255), (244, 244, 244),
    (65, 246, 246), (38, 158, 179), (255, 32, 121), (170, 28, 85),
    (255, 140, 66), (200, 90, 42), (255, 210, 74), (110, 231, 135),
]
MAGENTA = (255, 0, 255)


def parse_size(s):
    w, h = s.lower().split('x')
    return int(w), int(h)


def key_magenta(img, fuzz=0.16):
    """Magenta-Pixel transparent machen (fuzz = relativer RGB-Abstand)."""
    img = img.convert('RGBA')
    px = img.load()
    thr = (255 * fuzz) ** 2 * 3
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            d = (r - MAGENTA[0]) ** 2 + (g - MAGENTA[1]) ** 2 + (b - MAGENTA[2]) ** 2
            if d < thr:
                px[x, y] = (0, 0, 0, 0)
    return img


def remap(img, keep_alpha=True):
    """Auf die feste Palette mappen, ohne Dither. Transparenz bleibt erhalten."""
    rgba = img.convert('RGBA')
    pal_img = Image.new('P', (1, 1))
    flat = [c for rgb in PALETTE for c in rgb] + [0] * (768 - len(PALETTE) * 3)
    pal_img.putpalette(flat)
    rgb = rgba.convert('RGB').quantize(palette=pal_img, dither=Image.Dither.NONE).convert('RGBA')
    if keep_alpha:
        rgb.putalpha(rgba.getchannel('A'))
    return rgb


def cmd_sprite(args):
    img = Image.open(args.src)
    w, h = parse_size(args.size)
    img = img.resize((w, h), Image.Resampling.NEAREST)  # echtes Pixel-Grid
    if not args.no_key:
        img = key_magenta(img)
    if not args.no_remap:
        img = remap(img)
    if args.trim:
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
    img.save(args.out)
    print(f"{args.out} {img.width}x{img.height}")


def cmd_layer(args):
    img = Image.open(args.src)
    w, h = parse_size(args.size)
    img = img.resize((w, h), Image.Resampling.NEAREST)
    if args.key:
        img = key_magenta(img)
    img = remap(img, keep_alpha=True)
    img.save(args.out)
    print(f"{args.out} {img.width}x{img.height}")


def cmd_sheet(args):
    frames = [Image.open(f).convert('RGBA') for f in args.frames]
    w = max(f.width for f in frames)
    h = max(f.height for f in frames)
    sheet = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        # Frame unten-zentriert in die Zelle setzen (Lauf-Frames stehen auf dem Boden)
        sheet.paste(f, (i * w + (w - f.width) // 2, h - f.height))
    sheet.save(args.out)
    print(f"{args.out} {sheet.width}x{sheet.height} ({len(frames)} frames @ {w}x{h})")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)

    sp = sub.add_parser('sprite')
    sp.add_argument('src'); sp.add_argument('out')
    sp.add_argument('--size', required=True)
    sp.add_argument('--no-key', action='store_true')
    sp.add_argument('--no-remap', action='store_true')
    sp.add_argument('--trim', action='store_true')
    sp.set_defaults(fn=cmd_sprite)

    ly = sub.add_parser('layer')
    ly.add_argument('src'); ly.add_argument('out')
    ly.add_argument('--size', required=True)
    ly.add_argument('--key', action='store_true')
    ly.set_defaults(fn=cmd_layer)

    sh = sub.add_parser('sheet')
    sh.add_argument('out'); sh.add_argument('frames', nargs='+')
    sh.set_defaults(fn=cmd_sheet)

    args = ap.parse_args()
    args.fn(args)


if __name__ == '__main__':
    main()
