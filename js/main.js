// PuzzleBoard and computeBoardPx come from puzzleBoard.js and layout.js,
// loaded before this file as classic scripts (see index.html).

const pickBtn = document.getElementById('pickBtn');
const fileInput = document.getElementById('fileInput');
const gridSizeSel = document.getElementById('gridSize');
const shuffleBtn = document.getElementById('shuffleBtn');

const puzzle = new PuzzleBoard({
  boardEl: document.getElementById('board'),
  trayEl: document.getElementById('tray'),
  winEl: document.getElementById('win'),
  winStatsEl: document.getElementById('winStats'),
  statusEl: document.getElementById('status'),
});

let currentImgData = null; // data URL of the last uploaded (cropped) photo

function startWithGridSize() {
  puzzle.start({ imgData: currentImgData, gridSize: parseInt(gridSizeSel.value, 10) });
}

// Crops the uploaded photo to a centered square at the board's pixel size.
function loadPhoto(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
        const boardPx = computeBoardPx();
        const c = document.createElement('canvas');
        c.width = c.height = boardPx;
        c.getContext('2d').drawImage(img, sx, sy, s, s, 0, 0, boardPx, boardPx);
        resolve(c.toDataURL());
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

pickBtn.onclick = () => fileInput.click();
fileInput.onchange = async () => {
  const file = fileInput.files[0];
  if (!file) return;
  currentImgData = await loadPhoto(file);
  shuffleBtn.disabled = false;
  startWithGridSize();
};
gridSizeSel.onchange = () => { if (currentImgData) startWithGridSize(); };
shuffleBtn.onclick = () => { if (currentImgData) startWithGridSize(); };
