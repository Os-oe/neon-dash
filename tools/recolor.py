#!/usr/bin/env python3
"""Skin-Varianten per Palette-Swap aus den Volt-Frames (kostenlos, kein AI-Call).

blaze: Cyan- und Magenta-Kanäle getauscht (pinker Bot mit Cyan-Akzenten)
ori:   Weiß/Gold-Spirit (Brand-Tie-in, Konzept 2.5 Skin 3)
"""
from PIL import Image
import os

POSES = ['run1', 'run2', 'run3', 'run4', 'jump', 'slide', 'fly', 'death']

CYAN, CYAN_D = (65, 246, 246), (38, 158, 179)
MAG, MAG_D = (255, 32, 121), (170, 28, 85)
NAVY, NAVY_M = (26, 28, 44), (51, 52, 92)
PURP, GRAY, GRAY_L = (70, 51, 108), (90, 90, 134), (138, 138, 168)
ORANGE, ORANGE_D = (255, 140, 66), (200, 90, 42)
YELLOW, WHITE = (255, 210, 74), (244, 244, 244)

SKINS = {
    'blaze': {CYAN: MAG, CYAN_D: MAG_D, MAG: CYAN, MAG_D: CYAN_D},
    'ori': {
        CYAN: ORANGE, CYAN_D: ORANGE_D,
        MAG: YELLOW, MAG_D: (201, 140, 46),
        NAVY: (84, 70, 56), NAVY_M: (130, 110, 88),
        PURP: (130, 110, 88), GRAY: (190, 170, 140), GRAY_L: (224, 208, 178),
    },
}

os.chdir(os.path.join(os.path.dirname(__file__), '..'))
for skin, lut in SKINS.items():
    for pose in POSES:
        img = Image.open(f'assets/sprites/volt-{pose}.png').convert('RGBA')
        px = img.load()
        for y in range(img.height):
            for x in range(img.width):
                r, g, b, a = px[x, y]
                if a and (r, g, b) in lut:
                    px[x, y] = lut[(r, g, b)] + (a,)
        out = f'assets/sprites/{skin}-{pose}.png'
        img.save(out)
print('skins done')
