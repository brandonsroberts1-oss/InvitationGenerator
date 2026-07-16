/*
 * App wiring: form state -> live SVG preview -> SVG export.
 */

'use strict';

const state = {
  tagline: 'Decided on Forever',
  lineThe: 'the',
  title: 'Wedding',
  lineOf: 'of',
  name1: 'Amelia',
  name2: 'Benjamin',
  dayOfWeek: 'Saturday',
  month: 'June',
  dayNum: '20',
  year: '2026',
  time: 'At 4 PM',
  venue: 'The Grand Willow Estate',
  address: '1284 Riverbend Lane,\nCedar Falls, Iowa',
  rsvp: 'RSVP by May 1st, 2026',
  footer: 'Dinner & Dancing to Follow',
  template: 'botanical',
  motif: 'none',
  layout: 'classic',
  doorStyle: 'crackle',
  showDoors: true,
  showHeart: true,
  seed: 7,
};

/** Fields rendered in small caps on the invitation. */
const CAPS = new Set(['tagline', 'title', 'dayOfWeek', 'month', 'time', 'venue', 'footer']);

const TEXT_FIELDS = [
  'tagline', 'lineThe', 'title', 'lineOf', 'name1', 'name2',
  'dayOfWeek', 'month', 'dayNum', 'year', 'time',
  'venue', 'address', 'rsvp', 'footer',
];

function displayStrings() {
  const out = {};
  for (const k of TEXT_FIELDS) {
    const v = String(state[k] ?? '').trim();
    out[k] = CAPS.has(k) ? v.toUpperCase() : v;
  }
  out.names = [out.name1, out.name2].filter(Boolean).join('  &  ');
  out.addressLines = out.address ? out.address.split('\n').map((l) => l.trim()).filter(Boolean) : [];
  out.initials = [out.name1, out.name2]
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .join(' & ');
  return out;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

const previewBox = document.getElementById('preview');

function render() {
  document.body.dataset.template = state.template;
  const svg = buildInvitationSVG(displayStrings(), {
    template: state.template,
    motif: state.motif,
    layout: state.layout,
    doorStyle: state.doorStyle,
    showDoors: state.showDoors,
    showHeart: state.showHeart,
    seed: state.seed,
  });
  previewBox.replaceChildren(svg);
  fitTexts(svg);
}

/** Shrinks any text that overflows its allotted width (long names etc.). */
function fitTexts(svg) {
  for (const t of svg.querySelectorAll('text[data-maxw]')) {
    const maxW = parseFloat(t.dataset.maxw);
    for (let i = 0; i < 3; i++) {
      const len = t.getComputedTextLength();
      if (!len || len <= maxW + 0.1) break;
      const size = parseFloat(t.getAttribute('font-size'));
      t.setAttribute('font-size', (size * (maxW / len)).toFixed(2));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

const LASER = {
  cut: { stroke: '#FF0000', width: '0.1' },
  engraveLine: { stroke: '#000000', width: '0.35' },
};

function paintForLaser(clone) {
  clone.querySelectorAll('.preview-only').forEach((n) => n.remove());
  for (const n of clone.querySelectorAll('[data-layer]')) {
    const layer = n.getAttribute('data-layer');
    n.removeAttribute('class');
    if (layer === 'cut') {
      n.setAttribute('fill', 'none');
      n.setAttribute('stroke', LASER.cut.stroke);
      n.setAttribute('stroke-width', LASER.cut.width);
    } else if (layer === 'engrave-line') {
      n.setAttribute('fill', 'none');
      n.setAttribute('stroke', LASER.engraveLine.stroke);
      n.setAttribute('stroke-width', LASER.engraveLine.width);
    } else {
      n.setAttribute('fill', '#000000');
      n.setAttribute('stroke', 'none');
    }
  }
}

function serialize(svg) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    new XMLSerializer().serializeToString(svg)
  );
}

/** Laser-ready SVG: all text traced to outlines, cut=red / engrave=black. */
async function generateLaserSVG() {
  const clone = previewBox.querySelector('svg').cloneNode(true);
  await convertTextsToPaths(clone);
  paintForLaser(clone);
  return serialize(clone);
}

/** Same colours, but text kept editable (needs fonts wherever it's opened). */
function generateEditableSVG() {
  const clone = previewBox.querySelector('svg').cloneNode(true);
  paintForLaser(clone);
  return serialize(clone);
}

function download(text, filename) {
  const blob = new Blob([text], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

function bind() {
  for (const k of TEXT_FIELDS) {
    const input = document.getElementById(k);
    input.value = state[k];
    input.addEventListener('input', () => {
      state[k] = input.value;
      render();
    });
  }

  for (const k of ['showDoors', 'showHeart']) {
    const box = document.getElementById(k);
    box.checked = state[k];
    box.addEventListener('change', () => {
      state[k] = box.checked;
      render();
    });
  }

  const motifSel = document.getElementById('motif');
  for (const [id, m] of Object.entries(MOTIFS)) {
    motifSel.append(new Option(m.label, id));
  }
  for (const k of ['template', 'motif', 'layout', 'doorStyle']) {
    const sel = document.getElementById(k);
    sel.value = state[k];
    sel.addEventListener('change', () => {
      state[k] = sel.value;
      render();
    });
  }

  document.getElementById('shuffle').addEventListener('click', () => {
    state.seed = Math.floor(Math.random() * 1e9);
    render();
  });

  const status = document.getElementById('export-status');

  document.getElementById('export-laser').addEventListener('click', async () => {
    status.textContent = 'Tracing text to outlines...';
    try {
      download(await generateLaserSVG(), 'wedding-invitation-laser.svg');
      status.textContent = 'Saved wedding-invitation-laser.svg';
    } catch (err) {
      status.textContent = 'Export failed: ' + err.message;
    }
  });

  document.getElementById('export-editable').addEventListener('click', () => {
    download(generateEditableSVG(), 'wedding-invitation-editable.svg');
    status.textContent = 'Saved wedding-invitation-editable.svg';
  });
}

bind();
render();
// Re-measure once the display fonts are in, so auto-fit uses real metrics.
document.fonts.ready.then(render);
ensureFonts().catch(() => {}); // warm the export fonts in the background

// Hooks for automated tests.
window.__generateLaserSVG = generateLaserSVG;
window.__appReady = document.fonts.ready;
