(function() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes c4-drop {
      0%   { transform: translateY(-400%); opacity: 0.3; }
      60%  { transform: translateY(8%); }
      80%  { transform: translateY(-4%); }
      100% { transform: translateY(0); opacity: 1; }
    }
    .c4-piece-drop {
      animation: c4-drop 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }
    @keyframes c4-win-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(73,234,203,0.7); }
      50%       { box-shadow: 0 0 0 8px rgba(73,234,203,0); }
    }
    .c4-piece-win { animation: c4-win-pulse 0.8s ease-in-out infinite; }
  `;
  document.head.appendChild(style);

  // Patch the C4 render to add animation class on new pieces
  const origRender = window.renderConnect4Board;
  if (origRender) {
    window.renderConnect4Board = function(board, lastMove, ...args) {
      const result = origRender(board, lastMove, ...args);
      if (lastMove) {
        const cell = document.querySelector(`[data-c4-row="${lastMove.row}"][data-c4-col="${lastMove.col}"]`);
        if (cell) {
          cell.classList.remove('c4-piece-drop');
          void cell.offsetWidth; // reflow
          cell.classList.add('c4-piece-drop');
        }
      }
      return result;
    };
  }
  console.log('[HTP C4] Drop animation installed');
})();
