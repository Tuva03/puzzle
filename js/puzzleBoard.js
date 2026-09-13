// Depends on buildPieceShapes (jigsaw.js) and computeBoardPx (layout.js),
// both loaded before this file.

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// The board + tray: renders pieces, handles drag/drop between them, and
// tracks moves/time/win state for one puzzle instance.
//
// Dragging is implemented with pointer events rather than native HTML5
// drag-and-drop. The browser's native drag needs to hand a snapshot of the
// dragged element to the OS, and that pipeline doesn't reliably respect an
// arbitrary clip-path shape - under file:// it can silently drop the shape
// (or the whole custom image) entirely. A pointer-driven drag just moves
// the real, normally-rendered piece element, so its shape is always correct.
class PuzzleBoard {
  constructor({ boardEl, trayEl, winEl, winStatsEl, statusEl }) {
    this.boardEl = boardEl;
    this.trayEl = trayEl;
    this.winEl = winEl;
    this.winStatsEl = winStatsEl;
    this.statusEl = statusEl;

    this.N = 4;
    this.cell = 0;
    this.TAB = 0;
    this.boardPx = 480;
    this.imgData = null;
    this.board = [];       // board[slotIndex] = pieceId | null
    this.tray = [];        // array of pieceId, in tray order
    this.piecePaths = [];  // clip-path 'd' string per piece id, local to its own box
    this.moves = 0;
    this.startTime = 0;
    this.timerId = null;

    // SVG <clipPath> defs, one per piece id, referenced via clip-path: url(#...).
    this.clipDefsEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.clipDefsEl.setAttribute('width', '0');
    this.clipDefsEl.setAttribute('height', '0');
    this.clipDefsEl.style.position = 'absolute';
    document.body.appendChild(this.clipDefsEl);
  }

  // Starts a fresh, shuffled puzzle from an already-cropped photo.
  start({ imgData, gridSize }) {
    this.imgData = imgData;
    this.N = gridSize;
    this.boardPx = computeBoardPx();
    this.cell = this.boardPx / this.N;
    this.TAB = this.cell * 0.4;

    const total = this.N * this.N;
    this.board = new Array(total).fill(null);
    this.tray = shuffle([...Array(total).keys()]);
    this.piecePaths = buildPieceShapes(this.N, this.cell, this.TAB);
    this.rebuildClipDefs();

    this.moves = 0;
    this.startTime = Date.now();
    clearInterval(this.timerId);
    this.timerId = setInterval(() => this.updateStatus(), 1000);
    this.winEl.classList.remove('show');
    this.boardEl.style.width = this.boardEl.style.height = this.boardPx + 'px';
    this.render();
    this.updateStatus();
  }

  rebuildClipDefs() {
    const svgNS = 'http://www.w3.org/2000/svg';
    this.clipDefsEl.innerHTML = '';
    this.piecePaths.forEach((d, id) => {
      const clip = document.createElementNS(svgNS, 'clipPath');
      clip.setAttribute('id', `piece-clip-${id}`);
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', d);
      clip.appendChild(path);
      this.clipDefsEl.appendChild(clip);
    });
  }

  makePieceEl(id) {
    const div = document.createElement('div');
    div.className = 'piece';
    const box = this.cell + 2 * this.TAB;
    div.style.width = div.style.height = box + 'px';
    const row = Math.floor(id / this.N), col = id % this.N;
    div.style.backgroundImage = `url(${this.imgData})`;
    div.style.backgroundSize = `${this.boardPx}px ${this.boardPx}px`;
    div.style.backgroundPosition = `${this.TAB - col * this.cell}px ${this.TAB - row * this.cell}px`;
    div.style.clipPath = `url(#piece-clip-${id})`;
    div.dataset.id = id;
    div.addEventListener('pointerdown', e => this.startDrag(e, div, id));
    return div;
  }

  // Picks the piece up under the cursor: detaches it from its slot/tray,
  // floats it (position: fixed) so it visually follows the pointer, and
  // hands off to dropOnBoard/dropOnTray on release - same as before.
  startDrag(e, div, id) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const from = div.closest('.slot') ? +div.closest('.slot').dataset.index : 'tray';
    const rect = div.getBoundingClientRect();
    const grabX = e.clientX - rect.left, grabY = e.clientY - rect.top;

    // Best-effort: capture ensures the pointer keeps "belonging" to this
    // element even if it moves fast. Not required though - move/up listen
    // on window below, so this drag still works fine if capture fails.
    try { div.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    div.classList.add('dragging');
    div.style.position = 'fixed';
    div.style.left = rect.left + 'px';
    div.style.top = rect.top + 'px';
    div.style.pointerEvents = 'none'; // let elementFromPoint see through it
    document.body.appendChild(div);

    let target = null;
    const setTarget = next => {
      if (next === target) return;
      if (target) target.classList.remove('over');
      target = next;
      if (target) target.classList.add('over');
    };

    const onMove = ev => {
      div.style.left = (ev.clientX - grabX) + 'px';
      div.style.top = (ev.clientY - grabY) + 'px';
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const hit = under && (under.closest('.slot') || under.closest('#tray'));
      setTarget(hit || null);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const dropTarget = target;
      setTarget(null);
      this.drag = { id, from };
      if (dropTarget && dropTarget.classList.contains('slot')) {
        this.dropOnBoard(+dropTarget.dataset.index);
      } else if (dropTarget && dropTarget.id === 'tray') {
        this.dropOnTray();
      } else {
        this.drag = null;
        this.render(); // no target hit - snap back to where it came from
      }
      // render() rebuilds every piece fresh from board/tray state; this
      // floating element (appended straight to <body> at drag start,
      // outside board/tray) is never part of that and must be cleaned up
      // itself, or it's left behind as an orphaned duplicate.
      div.remove();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
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
    if (this.drag.from === i) { this.drag = null; this.render(); return; }
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
    if (this.drag.from === 'tray') { this.drag = null; this.render(); return; }
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
