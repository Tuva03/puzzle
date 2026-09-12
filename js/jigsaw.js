// Jigsaw piece silhouette geometry. Pure functions only - no DOM, no shared
// state - so a piece's shape can be computed from just its four edge signs.

// One tab/blank silhouette along a baseline (0,0)-(L,0); the knob bulges
// toward +v, flipped by `sign`. Returns points in local (u along, v perp) units.
function knobPoints(L, sign) {
  const R = L * 0.18, headV = R * 1.1, baseHalf = L * 0.15, gapHalf = 40, steps = 16;
  const cu = L / 2;
  const pts = [{ u: 0, v: 0 }, { u: cu - baseHalf, v: 0 }];
  const a0 = 270 - gapHalf, a1 = 270 + gapHalf - 360;
  for (let i = 0; i <= steps; i++) {
    const ang = (a0 + (a1 - a0) * i / steps) * Math.PI / 180;
    pts.push({ u: cu + R * Math.cos(ang), v: headV + R * Math.sin(ang) });
  }
  pts.push({ u: cu + baseHalf, v: 0 }, { u: L, v: 0 });
  return pts.map(p => ({ u: p.u, v: p.v * sign }));
}

function edgePoints(x0, y0, x1, y1, sign, len) {
  const dx = x1 - x0, dy = y1 - y0;
  const ux = dx / len, uy = dy / len, px = dy / len, py = dx / len;
  return knobPoints(len, sign).map(p => ({
    x: x0 + p.u * ux + p.v * px,
    y: y0 + p.u * uy + p.v * py,
  }));
}

// Smooth a point sequence into SVG cubic-bezier commands (Catmull-Rom), assuming
// the pen is already positioned at pts[0].
function smoothPath(pts) {
  const p = [pts[0], ...pts, pts[pts.length - 1]];
  let d = '';
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)} `;
  }
  return d;
}

// Build the clip-path 'd' string for one piece, in local coordinates of its own
// (cell + 2*TAB) box. Each side is either a straight board-edge line (sign===null)
// or a knob curve; sign is shared with the neighboring piece so shapes interlock.
function piecePath(topS, rightS, bottomS, leftS, cell, TAB) {
  const x0 = TAB, y0 = TAB, x1 = TAB + cell, y1 = TAB + cell;
  let d = `M ${x0},${y0} `;
  d += topS === null ? `L ${x1},${y0} ` : smoothPath(edgePoints(x0, y0, x1, y0, topS, cell));
  d += rightS === null ? `L ${x1},${y1} ` : smoothPath(edgePoints(x1, y0, x1, y1, rightS, cell));
  d += bottomS === null ? `L ${x0},${y1} ` : smoothPath(edgePoints(x0, y1, x1, y1, bottomS, cell).reverse());
  d += leftS === null ? `L ${x0},${y0} ` : smoothPath(edgePoints(x0, y0, x0, y1, leftS, cell).reverse());
  d += 'Z';
  return d;
}

// Build every piece's clip-path for an N x N grid. Internal edges get a random
// tab/blank orientation shared by both neighboring pieces, so they interlock
// correctly when a piece sits in its correct board slot.
function buildPieceShapes(N, cell, TAB) {
  const hSign = Array.from({ length: N - 1 }, () => Array.from({ length: N }, () => (Math.random() < 0.5 ? 1 : -1)));
  const vSign = Array.from({ length: N }, () => Array.from({ length: N - 1 }, () => (Math.random() < 0.5 ? 1 : -1)));
  const piecePaths = new Array(N * N);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const topS = r === 0 ? null : hSign[r - 1][c];
      const rightS = c === N - 1 ? null : vSign[r][c];
      const bottomS = r === N - 1 ? null : hSign[r][c];
      const leftS = c === 0 ? null : vSign[r][c - 1];
      piecePaths[r * N + c] = piecePath(topS, rightS, bottomS, leftS, cell, TAB);
    }
  }
  return piecePaths;
}
