/*
 * Geometry helpers: seeded RNG, path sampling, point-in-polygon tests and a
 * Bowyer-Watson Delaunay triangulation. These are used to generate the
 * laser-cut "lace" lattice on the fold-out doors.
 *
 * All coordinates are in millimetres (1 SVG user unit = 1 mm).
 */

'use strict';

/** Deterministic 32-bit PRNG so a given seed always yields the same lace. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Path segments                                                       */
/*                                                                     */
/* A shape is a list of segments:                                      */
/*   ['M', x, y] ['L', x, y] ['Q', cx, cy, x, y]                       */
/*   ['C', c1x, c1y, c2x, c2y, x, y] ['Z']                             */
/* From one list we derive both the SVG path string and a sampled      */
/* polygon for hit-testing, so the two can never drift apart.          */
/* ------------------------------------------------------------------ */

function segsToPath(segs) {
  return segs
    .map((s) => s[0] + s.slice(1).map((v) => round2(v)).join(' '))
    .join(' ');
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function transformSegs(segs, fn) {
  return segs.map((s) => {
    const out = [s[0]];
    for (let i = 1; i < s.length; i += 2) {
      const [x, y] = fn([s[i], s[i + 1]]);
      out.push(x, y);
    }
    return out;
  });
}

/** Sample a segment list into a closed polygon (array of [x, y]). */
function segsToPolygon(segs, samplesPerCurve = 10) {
  const poly = [];
  let cur = [0, 0];
  for (const s of segs) {
    const cmd = s[0];
    if (cmd === 'M' || cmd === 'L') {
      cur = [s[1], s[2]];
      poly.push(cur);
    } else if (cmd === 'Q') {
      const p0 = cur;
      const c = [s[1], s[2]];
      const p1 = [s[3], s[4]];
      for (let i = 1; i <= samplesPerCurve; i++) {
        const t = i / samplesPerCurve;
        const u = 1 - t;
        poly.push([
          u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
          u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
        ]);
      }
      cur = p1;
    } else if (cmd === 'C') {
      const p0 = cur;
      const c1 = [s[1], s[2]];
      const c2 = [s[3], s[4]];
      const p1 = [s[5], s[6]];
      for (let i = 1; i <= samplesPerCurve; i++) {
        const t = i / samplesPerCurve;
        const u = 1 - t;
        poly.push([
          u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
          u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
        ]);
      }
      cur = p1;
    }
    // 'Z' closes implicitly; the polygon is treated as closed.
  }
  return poly;
}

function pointInPolygon(pt, poly) {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Minimum distance from a point to the edges of a polygon. */
function distToPolygon(pt, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    best = Math.min(best, distToSegment(pt, poly[j], poly[i]));
  }
  return best;
}

function distToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}

/* ------------------------------------------------------------------ */
/* Delaunay triangulation (Bowyer-Watson)                              */
/* ------------------------------------------------------------------ */

function circumcircle(a, b, c) {
  const [ax, ay] = a;
  const [bx, by] = b;
  const [cx, cy] = c;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-12) return { x: 0, y: 0, r2: -1 };
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  const r2 = (ax - ux) ** 2 + (ay - uy) ** 2;
  return { x: ux, y: uy, r2 };
}

/** Returns triangles as index triples into `pts`. */
function triangulate(pts) {
  const n = pts.length;
  if (n < 3) return [];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const dmax = Math.max(maxX - minX, maxY - minY) || 1;
  const midx = (minX + maxX) / 2;
  const midy = (minY + maxY) / 2;

  const verts = pts.concat([
    [midx - 20 * dmax, midy - dmax],
    [midx, midy + 20 * dmax],
    [midx + 20 * dmax, midy - dmax],
  ]);

  let tris = [[n, n + 1, n + 2]];

  for (let i = 0; i < n; i++) {
    const p = verts[i];
    const bad = [];
    const good = [];
    for (const t of tris) {
      const cc = circumcircle(verts[t[0]], verts[t[1]], verts[t[2]]);
      const d2 = (p[0] - cc.x) ** 2 + (p[1] - cc.y) ** 2;
      if (cc.r2 > 0 && d2 < cc.r2) bad.push(t);
      else good.push(t);
    }
    // Edges of the cavity boundary appear exactly once among bad triangles.
    const edges = new Map();
    for (const t of bad) {
      for (const [a, b] of [
        [t[0], t[1]],
        [t[1], t[2]],
        [t[2], t[0]],
      ]) {
        const key = Math.min(a, b) + ',' + Math.max(a, b);
        const e = edges.get(key);
        if (e) e.count++;
        else edges.set(key, { a, b, count: 1 });
      }
    }
    tris = good;
    for (const { a, b, count } of edges.values()) {
      if (count === 1) tris.push([a, b, i]);
    }
  }

  return tris.filter((t) => t[0] < n && t[1] < n && t[2] < n);
}

/* ------------------------------------------------------------------ */
/* Lattice generation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Generates the crackle-lace cutouts for one door.
 *
 * @param bbox    [x0, y0, x1, y1] area to scatter points in
 * @param inside  (pt, clearance) => bool - region predicate
 * @param seed    RNG seed
 * Returns an array of SVG path strings, each one closed cutout polygon.
 */
function generateLattice({
  bbox,
  inside,
  seed,
  spacing = 10,
  jitter = 3.2,
  strut = 2.2,
  minInradius = 1.9,
  edgeMargin = 5.5,
}) {
  const rng = mulberry32(seed);
  const [x0, y0, x1, y1] = bbox;

  // Jittered grid of seed points, offset rows for a more organic look.
  const pts = [];
  let row = 0;
  for (let y = y0 + spacing / 2; y <= y1; y += spacing * 0.9, row++) {
    const off = row % 2 === 0 ? 0 : spacing / 2;
    for (let x = x0 + spacing / 2 + off; x <= x1; x += spacing) {
      const p = [x + (rng() * 2 - 1) * jitter, y + (rng() * 2 - 1) * jitter];
      if (inside(p, edgeMargin)) pts.push(p);
    }
  }

  const tris = triangulate(pts);
  const paths = [];
  const d = strut / 2;
  const maxEdge = spacing * 2.4;

  for (const [ia, ib, ic] of tris) {
    const A = pts[ia];
    const B = pts[ib];
    const C = pts[ic];

    const la = Math.hypot(B[0] - C[0], B[1] - C[1]); // opposite A
    const lb = Math.hypot(A[0] - C[0], A[1] - C[1]);
    const lc = Math.hypot(A[0] - B[0], A[1] - B[1]);
    if (Math.max(la, lb, lc) > maxEdge) continue; // spans a concavity

    const per = la + lb + lc;
    const area = Math.abs(
      (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])
    ) / 2;
    const r = (2 * area) / per; // inradius
    if (r < minInradius) continue;

    const ix = (la * A[0] + lb * B[0] + lc * C[0]) / per;
    const iy = (la * A[1] + lb * B[1] + lc * C[1]) / per;

    // Struts must not cross the notch, holes or heart: check edge midpoints.
    const mids = [
      [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2],
      [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2],
      [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2],
    ];
    if (!mids.every((m) => inside(m, 2.6))) continue;
    if (!inside([ix, iy], 2.6)) continue;

    // Uniform inset: scale towards the incenter so every side of the hole
    // sits strut/2 away from the triangle edge.
    const k = (r - d) / r;
    if (r - d < 1.1) continue;
    const v = [A, B, C].map(([x, y]) => [ix + (x - ix) * k, iy + (y - iy) * k]);
    paths.push(
      `M ${round2(v[0][0])} ${round2(v[0][1])} ` +
        `L ${round2(v[1][0])} ${round2(v[1][1])} ` +
        `L ${round2(v[2][0])} ${round2(v[2][1])} Z`
    );
  }

  return paths;
}
