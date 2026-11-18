"""Regenerate the site's icons and social card from its own fonts and tokens.

Writes public/favicon.svg (glyphs as paths, so it renders identically
everywhere), public/favicon.ico, public/apple-touch-icon.png and
public/og-image.jpg.

Usage (from the repo root, after `npm install`):

    python3 -m venv .venv && .venv/bin/pip install fonttools brotli pillow
    .venv/bin/python scripts/brand-assets.py

Colours mirror the tokens in src/styles/global.css; copy mirrors src/data/site.ts.
"""

from __future__ import annotations

import io
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
FONTS = ROOT / "node_modules" / "@fontsource-variable"

# Tokens (global.css). The icon uses the light theme's ink/accent (as the footer
# does); the social card uses the dark theme, the site's default.
INK, PAPER, ACCENT_LIGHT = "#191817", "#faf9f6", "#b8472d"
DARK = {
    "paper": "#161412",
    "ink": "#ede8df",
    "ink_soft": "#b9b0a4",
    "ink_faint": "#928a7e",
    "line": "#302b27",
    "accent": "#e07a5c",
    "accent_soft": "#3b2620",
}

NAME = "Mihir Rana"
MONOGRAM = "MR"
EYEBROW = "MACHINE LEARNING  ·  META"
TAGLINE = ["I build machine learning systems", "that people use every day."]
DOMAIN = "ranamihir.com"
PORTRAIT = ROOT / "src" / "assets" / "portrait.jpg"


def static_font(family: str, file: str, weight: int) -> TTFont:
    """A static instance of a Fontsource variable font at `weight`."""
    font = TTFont(FONTS / family / "files" / file)
    font = instantiateVariableFont(font, {"wght": weight})
    font.flavor = None
    return font


def pil_font(font: TTFont, size: int) -> ImageFont.FreeTypeFont:
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    return ImageFont.truetype(buf, size)


FRAUNCES = static_font("fraunces", "fraunces-latin-wght-normal.woff2", 500)
FRAUNCES_ITALIC = static_font("fraunces", "fraunces-latin-wght-italic.woff2", 400)
INTER = static_font("inter", "inter-latin-wght-normal.woff2", 400)
INTER_SEMIBOLD = static_font("inter", "inter-latin-wght-normal.woff2", 600)


# ---- favicon.svg ---------------------------------------------------------------

def text_path(font: TTFont, text: str, size: float, cx: float, baseline: float, tracking: float = 0) -> str:
    """SVG path data for `text`, horizontally centred on `cx`."""
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    names = [cmap[ord(ch)] for ch in text]
    width = sum(glyphs[n].width for n in names) * scale + tracking * (len(names) - 1)
    x = cx - width / 2
    pen = SVGPathPen(glyphs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    for n in names:
        glyphs[n].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        x += glyphs[n].width * scale + tracking
    return pen.getCommands()


def favicon_svg() -> str:
    d = text_path(FRAUNCES, MONOGRAM, size=30, cx=32, baseline=43, tracking=-1)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n'
        f'  <rect width="64" height="64" rx="14" fill="{INK}"/>\n'
        f'  <path fill="{PAPER}" d="{d}"/>\n'
        f'  <rect x="16" y="49" width="32" height="3" rx="1.5" fill="{ACCENT_LIGHT}"/>\n'
        "</svg>\n"
    )


# ---- raster icons --------------------------------------------------------------

def icon(size: int, rounded: bool) -> Image.Image:
    """The monogram tile at `size` px (drawn at 4x, then downsampled)."""
    s = size * 4
    u = s / 64  # one unit of the 64-unit favicon grid
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if rounded:
        draw.rounded_rectangle((0, 0, s - 1, s - 1), radius=14 * u, fill=INK)
    else:
        draw.rectangle((0, 0, s, s), fill=INK)
    font = pil_font(FRAUNCES, round(30 * u))
    draw.text((32 * u, 43 * u), MONOGRAM, font=font, fill=PAPER, anchor="ms")
    draw.rounded_rectangle((16 * u, 49 * u, 48 * u, 52 * u), radius=1.5 * u, fill=ACCENT_LIGHT)
    return img.resize((size, size), Image.LANCZOS)


# ---- og-image.png --------------------------------------------------------------

def og_image() -> Image.Image:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), DARK["paper"])
    draw = ImageDraw.Draw(img)

    # Portrait card on the right, with the hero's offset accent frame.
    pw, ph, r = 330, 412, 30
    px, py = W - 90 - pw, (H - ph) // 2 - 8
    draw.rounded_rectangle((px + 16, py + 16, px + pw + 16, py + ph + 16), radius=r, fill=DARK["accent_soft"])
    photo = ImageOps.fit(Image.open(PORTRAIT).convert("RGB"), (pw, ph), Image.LANCZOS)
    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, pw - 1, ph - 1), radius=r, fill=255)
    img.paste(photo, (px, py), mask)
    draw.rounded_rectangle((px, py, px + pw, py + ph), radius=r, outline=DARK["line"], width=2)

    # Text column.
    x = 90
    eyebrow = pil_font(INTER_SEMIBOLD, 21)
    cursor = x
    for ch in EYEBROW:  # 0.22em tracking, like .eyebrow
        draw.text((cursor, 120), ch, font=eyebrow, fill=DARK["ink_faint"])
        cursor += draw.textlength(ch, font=eyebrow) + 21 * 0.22
    draw.text((x - 4, 275), NAME, font=pil_font(FRAUNCES, 112), fill=DARK["ink"], anchor="ls")
    tagline = pil_font(FRAUNCES_ITALIC, 38)
    for i, line in enumerate(TAGLINE):
        draw.text((x, 345 + i * 52), line, font=tagline, fill=DARK["ink_soft"], anchor="ls")
    draw.rounded_rectangle((x, 435, x + 120, 440), radius=2.5, fill=DARK["accent"])
    draw.text((x, 525), DOMAIN, font=pil_font(INTER, 24), fill=DARK["ink"], anchor="ls")
    return img


def main() -> None:
    (PUBLIC / "favicon.svg").write_text(favicon_svg())
    icon(256, rounded=True).save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    # iOS applies its own mask, so the touch icon is full-bleed.
    icon(180, rounded=False).convert("RGB").save(PUBLIC / "apple-touch-icon.png", optimize=True)
    og_image().save(PUBLIC / "og-image.jpg", quality=86, optimize=True, progressive=True)
    print("Wrote favicon.svg, favicon.ico, apple-touch-icon.png, og-image.jpg to public/")


if __name__ == "__main__":
    main()
