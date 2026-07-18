/*
 * Listing photo mode: composes Etsy-ready marketing images (2400x1800 PNG)
 * from the live design - a hero shot, a one-of-a-kind variations grid, a
 * wood-tone lineup, a template showcase, and an engraving close-up.
 *
 * Everything is drawn into an SVG scene (wood table, grain, vignette,
 * drop shadows) with all text traced to outlines, then rasterised through a
 * canvas, so the PNGs are pixel-perfect and font-independent.
 */

'use strict';

/** Wood-only material palettes (board + engraving burn + cut edge). */
const WOODS = {
  maple: { label: 'Maple', board: '#e6c992', edge: '#9a7443', ink: '#3f2c16' },
  oak: { label: 'Golden oak', board: '#d9b579', edge: '#8f6a38', ink: '#452f16' },
  cherry: { label: 'Cherry', board: '#c08052', edge: '#7e4c28', ink: '#38200e' },
  walnut: { label: 'Walnut', board: '#96683f', edge: '#5c3d22', ink: '#241407' },
  birch: { label: 'Birch', board: '#f0dcb2', edge: '#b08d58', ink: '#4f3a20' },
};

const SCENE = {
  W: 2400,
  H: 1800,
  table: '#463322',
  hole: '#352718', // shows through the cutouts
  cream: '#f3e6cd',
  gold: '#dfb76d',
};

/* ------------------------------------------------------------------ */
/* Scene helpers                                                       */
/* ------------------------------------------------------------------ */

function baseCanvas() {
  const { W, H } = SCENE;
  const svg = el('svg', { xmlns: NS, viewBox: `0 0 ${W} ${H}`, width: W, height: H });

  const defs = el('defs');
  const grad = el('radialGradient', { id: 'vg', cx: '50%', cy: '46%', r: '75%' });
  grad.append(
    el('stop', { offset: '58%', 'stop-color': '#000', 'stop-opacity': '0' }),
    el('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': '0.34' })
  );
  const filter = el('filter', { id: 'ds', x: '-25%', y: '-25%', width: '150%', height: '150%' });
  filter.append(
    el('feDropShadow', {
      dx: '0',
      dy: '16',
      stdDeviation: '20',
      'flood-color': '#000',
      'flood-opacity': '0.5',
    })
  );
  defs.append(grad, filter);
  svg.append(defs);

  // Table top with grain and plank lines.
  svg.append(el('rect', { x: 0, y: 0, width: W, height: H, fill: SCENE.table }));
  const rng = mulberry32(4);
  for (let i = 0; i < 70; i++) {
    const x = rng() * W;
    svg.append(
      el('path', {
        d: `M ${round2(x)} 0 L ${round2(x + (rng() - 0.5) * 40)} ${H}`,
        stroke: '#000',
        'stroke-opacity': (0.04 + rng() * 0.06).toFixed(3),
        'stroke-width': (1.5 + rng() * 3.5).toFixed(1),
      })
    );
  }
  for (let i = 1; i < 5; i++) {
    svg.append(
      el('path', {
        d: `M ${i * 480 + (rng() - 0.5) * 60} 0 L ${i * 480 + (rng() - 0.5) * 60} ${H}`,
        stroke: '#000',
        'stroke-opacity': '0.16',
        'stroke-width': '5',
      })
    );
  }
  return svg;
}

function addVignette(svg) {
  svg.append(el('rect', { x: 0, y: 0, width: SCENE.W, height: SCENE.H, fill: 'url(#vg)' }));
}

/** Marketing text as traced outlines (px units). */
async function mktText(text, x, y, size, { font = 'serif', ls = 0, anchor = 'middle', color = SCENE.cream } = {}) {
  const fonts = await ensureFonts();
  const key = font === 'serifSemi' ? 'serifSemi' : font;
  return el('path', { d: textToPathD(fonts[key], text, x, y, size, ls, anchor), fill: color });
}

/* ------------------------------------------------------------------ */
/* Invitation instances                                                */
/* ------------------------------------------------------------------ */

function paintWoodSvg(svg, tone) {
  for (const n of svg.querySelectorAll('[data-layer]')) {
    const cls = n.getAttribute('class') || '';
    const layer = n.getAttribute('data-layer');
    if (layer === 'cut') {
      if (cls.includes('board')) {
        n.setAttribute('fill', tone.board);
        n.setAttribute('stroke', tone.edge);
        n.setAttribute('stroke-width', '0.35');
      } else {
        n.setAttribute('fill', SCENE.hole);
        n.setAttribute('stroke', 'none');
      }
    } else if (layer === 'engrave') {
      n.setAttribute('fill', tone.ink);
      n.setAttribute('stroke', 'none');
    } else {
      n.setAttribute('fill', 'none');
      n.setAttribute('stroke', tone.ink);
      n.setAttribute('stroke-width', '0.35');
    }
    n.removeAttribute('class');
  }
}

/**
 * Builds one finished invitation as a positioned scene group.
 * place: {cx, cy, box:{w,h}, rot, scale, focus:[mmX,mmY], shadow}
 */
async function inviteGroup(opts, tone, place) {
  const svg = buildInvitationSVG(displayStrings(), opts);

  // Must be laid out (off-screen) for text measurement to work.
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;left:-99999px;top:0;width:900px';
  document.body.append(holder);
  holder.append(svg);
  fitTexts(svg);
  await convertTextsToPaths(svg);
  paintWoodSvg(svg, tone);
  holder.remove();

  const vb = svg.viewBox.baseVal;
  const k = place.scale || Math.min(place.box.w / vb.width, place.box.h / vb.height);
  const fx = place.focus ? place.focus[0] : vb.x + vb.width / 2;
  const fy = place.focus ? place.focus[1] : vb.y + vb.height / 2;

  const attrs = {
    transform:
      `translate(${round2(place.cx)} ${round2(place.cy)}) rotate(${place.rot || 0}) ` +
      `scale(${round2(k)}) translate(${round2(-fx)} ${round2(-fy)})`,
  };
  if (place.shadow !== false) attrs.filter = 'url(#ds)';
  const g = el('g', attrs);
  while (svg.firstChild) g.append(svg.firstChild);
  return g;
}

function currentOpts(overrides = {}) {
  return {
    template: state.template,
    motif: state.motif,
    layout: state.layout,
    doorStyle: state.doorStyle,
    showDoors: state.showDoors,
    showHeart: state.showHeart,
    seed: state.seed,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* The five images                                                     */
/* ------------------------------------------------------------------ */

async function heroImage(tone) {
  const svg = baseCanvas();
  const tx = 620;
  svg.append(await mktText('Laser-Cut', tx, 560, 150, { font: 'serifSemi' }));
  svg.append(await mktText('Wedding Invitations', tx, 700, 96, { font: 'serifSemi' }));
  svg.append(await mktText('engraved on real wood', tx, 850, 100, { font: 'script', color: SCENE.gold }));
  svg.append(el('rect', { x: tx - 160, y: 925, width: 320, height: 5, fill: SCENE.gold }));
  svg.append(await mktText('REAL WOOD  ·  5 x 7 IN', tx, 1030, 50, { ls: 6 }));
  svg.append(await mktText('FULLY PERSONALIZED', tx, 1115, 50, { ls: 6 }));
  svg.append(await mktText('NO TWO EVER ALIKE', tx, 1200, 50, { ls: 6 }));
  if (state.brand) {
    svg.append(await mktText(state.brand.toUpperCase(), tx, 1660, 44, { ls: 5, color: SCENE.gold }));
  }
  svg.append(
    await inviteGroup(currentOpts(), tone, {
      cx: 1680, cy: 900, box: { w: 1320, h: 1560 }, rot: 2,
    })
  );
  addVignette(svg);
  return { title: 'Hero shot', name: 'listing-1-hero.png', svg };
}

async function variationsImage(tone) {
  const svg = baseCanvas();
  svg.append(await mktText('No two are ever alike', 1200, 210, 124, { font: 'script', color: SCENE.gold }));
  svg.append(
    await mktText('EVERY INVITATION IS GENERATED UNIQUELY FOR YOU', 1200, 300, 44, { ls: 6 })
  );

  const gatefold = state.template === 'gatefold';
  const motifs = ['none', 'tree', 'wreath', 'grandtree', 'mountains', 'cake'];
  const layouts = ['classic', 'modern', 'editorial', 'crest', 'classic', 'editorial'];
  const doorStyles = ['crackle', 'floral', 'mandala', 'floral'];

  const spots = gatefold
    ? [
        { cx: 660, cy: 720 }, { cx: 1740, cy: 720 },
        { cx: 660, cy: 1330 }, { cx: 1740, cy: 1330 },
      ]
    : [
        { cx: 480, cy: 730 }, { cx: 1200, cy: 730 }, { cx: 1920, cy: 730 },
        { cx: 480, cy: 1360 }, { cx: 1200, cy: 1360 }, { cx: 1920, cy: 1360 },
      ];
  const box = gatefold ? { w: 1010, h: 560 } : { w: 660, h: 590 };

  for (let i = 0; i < spots.length; i++) {
    const overrides = { seed: Math.floor(Math.random() * 1e9) };
    if (gatefold) overrides.doorStyle = doorStyles[i % doorStyles.length];
    else {
      overrides.motif = motifs[i % motifs.length];
      overrides.layout = layouts[i % layouts.length];
    }
    svg.append(
      await inviteGroup(currentOpts(overrides), tone, {
        ...spots[i], box, rot: i % 2 ? 1.6 : -1.6,
      })
    );
  }
  addVignette(svg);
  return { title: 'One-of-a-kind grid', name: 'listing-2-variations.png', svg };
}

async function woodTonesImage() {
  const svg = baseCanvas();
  svg.append(await mktText('Choose your wood', 1200, 200, 110, { font: 'serifSemi' }));
  svg.append(await mktText('five hand-finished tones', 1200, 300, 84, { font: 'script', color: SCENE.gold }));

  const keys = Object.keys(WOODS);
  for (let i = 0; i < keys.length; i++) {
    const tone = WOODS[keys[i]];
    const cx = SCENE.W * ((i + 0.5) / keys.length);
    svg.append(
      await inviteGroup(currentOpts(), tone, {
        cx, cy: 830, box: { w: 430, h: 940 }, rot: i % 2 ? 1.4 : -1.4,
      })
    );
    svg.append(await mktText(tone.label.toUpperCase(), cx, 1420, 46, { ls: 5 }));
  }
  svg.append(await mktText('ALL PIECES CUT & ENGRAVED TO ORDER', 1200, 1650, 44, { ls: 6, color: SCENE.gold }));
  addVignette(svg);
  return { title: 'Wood tones', name: 'listing-3-wood-tones.png', svg };
}

async function stylesImage(tone) {
  const svg = baseCanvas();
  svg.append(await mktText('Four signature styles', 1200, 190, 108, { font: 'serifSemi' }));

  const cards = [
    { tpl: 'botanical', label: 'BOTANICAL ARCH', cx: 480 },
    { tpl: 'arch', label: 'ARCH MINIMAL', cx: 1200 },
    { tpl: 'wave', label: 'WAVY EDGE', cx: 1920 },
  ];
  for (const c of cards) {
    svg.append(
      await inviteGroup(currentOpts({ template: c.tpl }), tone, {
        cx: c.cx, cy: 720, box: { w: 620, h: 840 },
      })
    );
    svg.append(await mktText(c.label, c.cx, 1195, 40, { ls: 5 }));
  }
  svg.append(
    await inviteGroup(currentOpts({ template: 'gatefold', showDoors: true }), tone, {
      cx: 1200, cy: 1480, box: { w: 1560, h: 500 },
    })
  );
  svg.append(await mktText('GATEFOLD LACE DOORS', 1200, 1765, 40, { ls: 5 }));
  addVignette(svg);
  return { title: 'Signature styles', name: 'listing-4-styles.png', svg };
}

async function detailImage(tone) {
  const svg = baseCanvas();
  const focus = state.template === 'gatefold' ? [128.5, 85] : [63.5, 85];
  svg.append(
    await inviteGroup(currentOpts(), tone, {
      cx: 1200, cy: 900, box: { w: 0, h: 0 }, scale: 26, rot: 2, focus, shadow: false,
    })
  );
  svg.append(el('rect', { x: 0, y: 1560, width: SCENE.W, height: 240, fill: '#000', opacity: 0.55 }));
  svg.append(
    await mktText('personalized down to the last detail', 1200, 1700, 90, { font: 'script', color: SCENE.gold })
  );
  addVignette(svg);
  return { title: 'Engraving close-up', name: 'listing-5-detail.png', svg };
}

/* ------------------------------------------------------------------ */
/* Rasterise + gallery                                                 */
/* ------------------------------------------------------------------ */

async function svgToPngUrl(svg) {
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
  const svgUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error('SVG rasterisation failed'));
    img.src = svgUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = SCENE.W;
  canvas.height = SCENE.H;
  canvas.getContext('2d').drawImage(img, 0, 0, SCENE.W, SCENE.H);
  URL.revokeObjectURL(svgUrl);
  return new Promise((res) => canvas.toBlob((b) => res(URL.createObjectURL(b)), 'image/png'));
}

async function generateListingPhotos(onProgress) {
  const tone = WOODS[state.woodTone] || WOODS.maple;
  const builders = [heroImage, variationsImage, woodTonesImage, stylesImage, detailImage];
  const items = [];
  for (let i = 0; i < builders.length; i++) {
    onProgress?.(`Rendering image ${i + 1} of ${builders.length}...`);
    const { title, name, svg } = await (builders[i] === woodTonesImage
      ? woodTonesImage()
      : builders[i](tone));
    items.push({ title, name, url: await svgToPngUrl(svg) });
  }
  return items;
}
