/*
 * Text -> vector outline conversion for the laser-ready export.
 *
 * Laser software (LightBurn, Glowforge, Inkscape, ...) usually can't resolve
 * web fonts referenced from an SVG, so on export every <text> element is
 * replaced with a <path> traced from the actual font file via opentype.js.
 */

'use strict';

const FONT_FILES = {
  script: 'fonts/GreatVibes-Regular.ttf',
  serif: 'fonts/PlayfairDisplay-Regular.ttf',
  serifSemi: 'fonts/PlayfairDisplay-SemiBold.ttf',
  serifItalic: 'fonts/PlayfairDisplay-Italic.ttf',
};

let fontsPromise = null;

/** Loads and parses all font files once; returns {key: opentype.Font}. */
function ensureFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const entries = await Promise.all(
        Object.entries(FONT_FILES).map(async ([key, url]) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
          const buf = await res.arrayBuffer();
          return [key, opentype.parse(buf)];
        })
      );
      return Object.fromEntries(entries);
    })();
    fontsPromise.catch(() => {
      fontsPromise = null; // allow a retry after e.g. a network hiccup
    });
  }
  return fontsPromise;
}

/**
 * Path data for `text` with its horizontal centre at x and baseline at y.
 * Letter-spacing (ls, in mm) matches the preview's letter-spacing attribute.
 */
function textToPathD(font, text, x, y, size, ls = 0) {
  if (!text) return '';

  if (!ls) {
    const width = font.getAdvanceWidth(text, size, { kerning: true });
    return font
      .getPath(text, x - width / 2, y, size, { kerning: true })
      .toPathData(3);
  }

  // With letter-spacing, lay glyphs out one at a time.
  const chars = [...text];
  let width = ls * (chars.length - 1);
  for (const ch of chars) width += font.getAdvanceWidth(ch, size);

  let cursor = x - width / 2;
  let d = '';
  for (const ch of chars) {
    d += font.getPath(ch, cursor, y, size).toPathData(3);
    cursor += font.getAdvanceWidth(ch, size) + ls;
  }
  return d;
}

/** Replaces every <text> in the (cloned) SVG with traced outline paths. */
async function convertTextsToPaths(svgRoot) {
  const fonts = await ensureFonts();
  for (const t of [...svgRoot.querySelectorAll('text')]) {
    const font = fonts[t.dataset.font || 'serif'];
    const d = textToPathD(
      font,
      t.textContent,
      parseFloat(t.getAttribute('x')),
      parseFloat(t.getAttribute('y')),
      parseFloat(t.getAttribute('font-size')),
      parseFloat(t.getAttribute('letter-spacing') || 0)
    );
    if (d) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('data-layer', 'engrave');
      t.replaceWith(p);
    } else {
      t.remove();
    }
  }
}
