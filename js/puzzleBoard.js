// Depends on buildPieceShapes (jigsaw.js), hasLookalikePieces (imageAnalysis.js)
// and computeBoardPx (layout.js), all loaded before this file.

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// The board + tray: renders pieces, handles drag/drop between them, and
// tracks moves/time/win state for one puzzle instance.
class PuzzleBoard {
  constructor({ boardEl, trayEl, winEl, winStatsEl, statusEl, dupWarningEl }) {
    this.boardEl = boardEl;
    this.trayEl = trayEl;
    this.winEl = winEl;
    this.winStatsEl = winStatsEl;
    this.statusEl = statusEl;
    this.dupWarningEl = dupWarningEl;

    this.N = 4;
    this.cell = 0;
    this.TAB = 0;
    this.boardPx = 480;
    this.imgData = null;
    this.srcCanvas = null;
    this.board = [];       // board[slotIndex] = pieceId | null
    this.tray = [];        // array of pieceId, in tray order
    this.piecePaths = [];  // clip-path 'd' string per piece id, local to its own box
    this.moves = 0;
    this.startTime = 0;
    this.timerId = null;
    this.drag = null;      // { id, from: 'tray' | slotIndex }

    this.trayEl.addEventListener('dragover', e => { e.preventDefault(); this.trayEl.classList.add('over'); });
    this.trayEl.addEventListener('dragleave', () => this.trayEl.classList.remove('over'));
    this.trayEl.addEventListener('drop', e => {
      e.preventDefault();
      this.trayEl.classList.remove('over');
      this.dropOnTray();
    });
  }

  // Starts a fresh, shuffled puzzle from an already-cropped photo.
  start({ imgData, srcCanvas, gridSize }) {
    this.imgData = imgData;
    this.srcCanvas = srcCanvas;
    this.N = gridSize;
    this.boardPx = computeBoardPx();
    this.cell = this.boardPx / this.N;
    this.TAB = this.cell * 0.4;

    const total = this.N * this.N;
    this.board = new Array(total).fill(null);
    this.tray = shuffle([...Array(total).keys()]);
    this.piecePaths = buildPieceShapes(this.N, this.cell, this.TAB);
    this.dupWarningEl.classList.toggle('show', hasLookalikePieces(this.srcCanvas, this.N));

    this.moves = 0;
    this.startTime = Date.now();
    clearInterval(this.timerId);
    this.timerId = setInterval(() => this.updateStatus(), 1000);
    this.winEl.classList.remove('show');
    this.boardEl.style.width = this.boardEl.style.height = this.boardPx + 'px';
    this.render();
    this.updateStatus();
  }

  makePieceEl(id) {
    const div = document.createElement('div');
    div.className = 'piece';
    div.draggable = true;
    const box = this.cell + 2 * this.TAB;
    div.style.width = div.style.height = box + 'px';
    const row = Math.floor(id / this.N), col = id % this.N;
    div.style.backgroundImage = `url(${this.imgData})`;
    div.style.backgroundSize = `${this.boardPx}px ${this.boardPx}px`;
    div.style.backgroundPosition = `${this.TAB - col * this.cell}px ${this.TAB - row * this.cell}px`;
    div.style.clipPath = `path('${this.piecePaths[id]}')`;
    div.dataset.id = id;
    div.addEventListener('dragstart', e => {
      const from = div.closest('.slot') ? +div.closest('.slot').dataset.index : 'tray';
      this.drag = { id, from };
      e.dataTransfer.effectAllowed = 'move';
    });
    return div;
  }

  render() {
    this.boardEl.innerHTML = '';
    for (let i = 0; i < this.N * this.N; i++) {
      const r = Math.floor(i / this.N), c = i % this.N;
      const slot = document.createElement('div');
      slot.className = 'slot' + (this.board[i] === null ? ' empty' : '');
      slot.dataset.index = i;
      slot.style.left = c * this.cell + 'px';
      slot.style.top = r * this.cell + 'px';
      slot.style.width = slot.style.height = this.cell + 'px';
      if (this.board[i] !== null) {
        const piece = this.makePieceEl(this.board[i]);
        piece.style.position = 'absolute';
        piece.style.left = piece.style.top = -this.TAB + 'px';
        slot.appendChild(piece);
      }
      slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('over'); });
      slot.addEventListener('dragleave', () => slot.classList.remove('over'));
      slot.addEventListener('drop', e => {
        e.preventDefault();
        slot.classList.remove('over');
        this.dropOnBoard(i);
      });
      this.boardEl.appendChild(slot);
    }

    this.trayEl.innerHTML = '';
    if (this.tray.length === 0 && !this.imgData) {
      this.trayEl.appendChild(Object.assign(document.createElement('div'), { id: 'empty-hint', textContent: 'Upload a photo to start the puzzle' }));
    } else {
      this.tray.forEach(id => this.trayEl.appendChild(this.makePieceEl(id)));
    }
  }

  dropOnBoard(i) {
    if (!this.drag) return;
    if (this.drag.from === i) { this.drag = null; return; }
    const occupant = this.board[i];
    this.board[i] = this.drag.id;
    if (this.drag.from === 'tray') {
      this.tray = this.tray.filter(id => id !== this.drag.id);
      if (occupant !== null) this.tray.push(occupant);
    } else {
      this.board[this.drag.from] = occupant;
    }
    this.moves++;
    this.drag = null;
    this.render();
    this.updateStatus();
    this.checkWin();
  }

  dropOnTray() {
    if (!this.drag) return;
    if (this.drag.from === 'tray') { this.drag = null; return; }
    this.board[this.drag.from] = null;
    this.tray.push(this.drag.id);
    this.moves++;
    this.drag = null;
    this.render();
    this.updateStatus();
  }

  checkWin() {
    if (this.board.every((id, i) => id === i)) {
      clearInterval(this.timerId);
      const secs = Math.round((Date.now() - this.startTime) / 1000);
      this.winStatsEl.textContent = `${this.moves} moves · ${secs}s`;
      this.winEl.classList.add('show');
    }
  }

  updateStatus() {
    const secs = Math.round((Date.now() - this.startTime) / 1000);
    this.statusEl.textContent = `Moves: ${this.moves} · Time: ${secs}s`;
  }
}
