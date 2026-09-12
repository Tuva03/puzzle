// Pixel-level analysis of the source photo: detecting when the sliced pieces
// will look alike (a flat/uniform photo area, not a code bug).

// A photo with a large flat/uniform area (sky, plain wall) can slice into
// pieces that are pixel-different but visually indistinguishable. This flags
// that case by comparing average piece color; it can't reliably catch a
// repeating *textured* pattern (bricks, fabric) since that needs real
// texture analysis, not just color comparison. We can't fix the photo
// either way, so just tell the user rather than leave them confused.
const sigCanvas = document.createElement('canvas');
sigCanvas.width = sigCanvas.height = 4;
const sigCtx = sigCanvas.getContext('2d', { willReadFrequently: true });

function pieceSignature(srcCanvas, row, col, N) {
  const sw = srcCanvas.width / N, sh = srcCanvas.height / N;
  sigCtx.drawImage(srcCanvas, col * sw, row * sh, sw, sh, 0, 0, 4, 4);
  return sigCtx.getImageData(0, 0, 4, 4).data;
}

function hasLookalikePieces(srcCanvas, N) {
  const total = N * N;
  const sigs = new Array(total);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) sigs[r * N + c] = pieceSignature(srcCanvas, r, c, N);
  const SIMILAR = 16; // avg per-channel difference below this reads as "looks the same"
  for (let i = 0; i < total; i++) {
    for (let j = i + 1; j < total; j++) {
      let diff = 0;
      for (let k = 0; k < sigs[i].length; k++) diff += Math.abs(sigs[i][k] - sigs[j][k]);
      if (diff / sigs[i].length < SIMILAR) return true;
    }
  }
  return false;
}
