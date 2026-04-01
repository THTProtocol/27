(function() {
  let draggedPiece = null;
  let dragSource = null;

  function installDnD() {
    const board = document.querySelector('.chess-board, #chess-board, [data-board="chess"]');
    if (!board) { setTimeout(installDnD, 1000); return; }

    board.addEventListener('dragstart', e => {
      const cell = e.target.closest('[data-sq]');
      if (!cell || !cell.querySelector('.piece')) return;
      dragSource = cell.dataset.sq;
      draggedPiece = cell.querySelector('.piece').textContent;
      e.dataTransfer.effectAllowed = 'move';
      cell.classList.add('dragging');
    });

    board.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const cell = e.target.closest('[data-sq]');
      if (cell) cell.classList.add('drag-over');
    });

    board.addEventListener('dragleave', e => {
      const cell = e.target.closest('[data-sq]');
      if (cell) cell.classList.remove('drag-over');
    });

    board.addEventListener('drop', e => {
      e.preventDefault();
      const cell = e.target.closest('[data-sq]');
      if (!cell) return;
      const target = cell.dataset.sq;
      cell.classList.remove('drag-over');
      document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
      if (dragSource && target && dragSource !== target) {
        // Fire HTP move handler
        if (typeof window.htpChessMove === 'function') {
          window.htpChessMove(dragSource, target);
        } else {
          // Fallback: simulate click sequence
          const srcCell = board.querySelector(`[data-sq="${dragSource}"]`);
          const tgtCell = board.querySelector(`[data-sq="${target}"]`);
          if (srcCell) srcCell.click();
          setTimeout(() => { if (tgtCell) tgtCell.click(); }, 50);
        }
      }
      dragSource = null;
    });

    // Make pieces draggable
    const observer = new MutationObserver(() => {
      board.querySelectorAll('[data-sq]').forEach(cell => {
        cell.setAttribute('draggable', 'true');
      });
    });
    observer.observe(board, { childList: true, subtree: true });
    board.querySelectorAll('[data-sq]').forEach(cell => {
      cell.setAttribute('draggable', 'true');
    });
    console.log('[HTP DnD] Chess drag-and-drop installed');
  }

  window.addEventListener('htpWasmReady', installDnD);
  window.addEventListener('htpWasmFailed', installDnD);
  document.addEventListener('DOMContentLoaded', () => setTimeout(installDnD, 2000));
})();
