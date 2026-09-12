// Shared board-sizing rule, used both when preparing the crop canvas and
// when the puzzle board itself renders, so the two stay in sync.
function computeBoardPx() {
  const avail = Math.min(520, window.innerWidth - 40);
  const unit = 60; // divides evenly by 3,4,5,6 -> no subpixel gaps between cells
  return Math.max(5, Math.floor(avail / unit)) * unit;
}
