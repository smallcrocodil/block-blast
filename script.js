const boardGrid = document.getElementById('board-grid');
const previewCanvas = document.getElementById('preview-canvas');
const scoreValue = document.getElementById('score-value');
const highscoreValue = document.getElementById('highscore-value');
const restartButton = document.getElementById('restart-button');

const previewContext = previewCanvas ? previewCanvas.getContext('2d') : null;
const waitingArea = document.getElementById('waiting-area');
let boardState = [];
let waitingBlocks = [];
let selectedBlock = null;
let activeSlotIndex = null;
let floatingBlockElement = null;
let currentScore = 0;
let isWaitingPointerListenerAttached = false;

const blockShapes = [
  {
    name: 'single',
    color: '#4ae8ff',
    cells: [[0, 0]],
  },
  {
    name: 'square-2',
    color: '#6f8bff',
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]],
  },
  {
    name: 'line-5',
    color: '#ff8d6c',
    cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  },
  {
    name: 'line-3',
    color: '#f3ff64',
    cells: [[0, 0], [1, 0], [2, 0]],
  },
  {
    name: 'l-shape',
    color: '#ac64ff',
    cells: [[0, 0], [0, 1], [0, 2], [1, 2]],
  },
  {
    name: 't-shape',
    color: '#52ffa8',
    cells: [[0, 1], [1, 0], [1, 1], [2, 1]],
  },
  {
    name: 'z-shape',
    color: '#ff5ec2',
    cells: [[0, 0], [1, 0], [1, 1], [2, 1]],
  },
  {
    name: 's-shape',
    color: '#5ad1ff',
    cells: [[1, 0], [2, 0], [0, 1], [1, 1]],
  },
  {
    name: 'l-small',
    color: '#ffb362',
    cells: [[0, 0], [0, 1], [1, 1]],
  },
  {
    name: 'block-3x3',
    color: '#4dff6e',
    cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  },
  {
    name: 'block-1x2',
    color: '#d863ff',
    cells: [[0, 0], [1, 0]],
  },
  {
    name: 'block-2x3',
    color: '#92ff6f',
    cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]],
  },
];

function getRandomBlock() {
  const index = Math.floor(Math.random() * blockShapes.length);
  const block = blockShapes[index];
  return {
    ...block,
    id: `${block.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function createBoardCells() {
  boardGrid.innerHTML = '';

  for (let index = 0; index < 100; index += 1) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.dataset.index = index;
    boardGrid.appendChild(cell);
  }
}

function getBoardCellFromPoint(clientX, clientY) {
  const boardRect = boardGrid.getBoundingClientRect();
  if (
    clientX < boardRect.left ||
    clientX > boardRect.right ||
    clientY < boardRect.top ||
    clientY > boardRect.bottom
  ) {
    return null;
  }

  const cellWidth = boardRect.width / 10;
  const cellHeight = boardRect.height / 10;
  const col = Math.floor((clientX - boardRect.left) / cellWidth);
  const row = Math.floor((clientY - boardRect.top) / cellHeight);

  return {
    row: Math.min(Math.max(row, 0), 9),
    col: Math.min(Math.max(col, 0), 9),
    index: row * 10 + col,
  };
}

function canPlaceBlockAt(row, col, block) {
  return block.cells.every(([dx, dy]) => {
    const targetRow = row + dy;
    const targetCol = col + dx;
    if (targetRow < 0 || targetRow >= 10 || targetCol < 0 || targetCol >= 10) {
      return false;
    }
    return boardState[targetRow][targetCol] === null;
  });
}

function placeBlockAt(row, col, block) {
  block.cells.forEach(([dx, dy]) => {
    const targetRow = row + dy;
    const targetCol = col + dx;
    boardState[targetRow][targetCol] = {
      id: block.id,
      name: block.name,
      color: block.color,
    };
    renderBoardCell(targetRow, targetCol);
  });
}

function renderBoardCell(row, col) {
  const index = row * 10 + col;
  const cell = boardGrid.querySelector(`.grid-cell[data-index='${index}']`);
  const cellValue = boardState[row][col];
  if (cellValue) {
    cell.style.background = cellValue.color;
    cell.style.boxShadow = `0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 0 0 2px rgba(255, 255, 255, 0.05)`;
  } else {
    cell.style.background = 'rgba(255, 255, 255, 0.02)';
    cell.style.boxShadow = 'none';
  }
}

function renderBoard() {
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      renderBoardCell(row, col);
    }
  }
}

function getCompletedRows() {
  return boardState.reduce((rows, rowData, rowIndex) => {
    if (rowData.every((cell) => cell !== null)) {
      rows.push(rowIndex);
    }
    return rows;
  }, []);
}

function clearRow(row) {
  for (let col = 0; col < 10; col += 1) {
    boardState[row][col] = null;
    renderBoardCell(row, col);
  }
}

function getCompletedColumns() {
  const completedCols = [];
  for (let col = 0; col < 10; col += 1) {
    let filled = true;
    for (let row = 0; row < 10; row += 1) {
      if (boardState[row][col] === null) {
        filled = false;
        break;
      }
    }
    if (filled) completedCols.push(col);
  }
  return completedCols;
}

function clearColumn(col) {
  for (let row = 0; row < 10; row += 1) {
    boardState[row][col] = null;
    renderBoardCell(row, col);
  }
}

function animateLineClear(rows, cols) {
  const indices = new Set();
  rows.forEach((row) => {
    for (let col = 0; col < 10; col += 1) {
      indices.add(row * 10 + col);
    }
  });
  cols.forEach((col) => {
    for (let row = 0; row < 10; row += 1) {
      indices.add(row * 10 + col);
    }
  });

  indices.forEach((index) => {
    const cell = boardGrid.querySelector(`.grid-cell[data-index='${index}']`);
    if (cell) cell.classList.add('clearing');
  });

  setTimeout(() => {
    indices.forEach((index) => {
      const cell = boardGrid.querySelector(`.grid-cell[data-index='${index}']`);
      if (cell) cell.classList.remove('clearing');
    });
    rows.forEach(clearRow);
    cols.forEach(clearColumn);
  }, 180);
}

function clearCompletedLines() {
  const completedRows = getCompletedRows();
  const completedCols = getCompletedColumns();
  if (!completedRows.length && !completedCols.length) return 0;

  animateLineClear(completedRows, completedCols);
  return completedRows.length + completedCols.length;
}

function addScore(points) {
  currentScore += points;
  scoreValue.textContent = currentScore;
}

function createWaitingBlockElement(block) {
  const blockElement = document.createElement('div');
  const cols = Math.max(...block.cells.map(([x]) => x)) + 1;
  const rows = Math.max(...block.cells.map(([, y]) => y)) + 1;

  blockElement.className = 'waiting-block';
  blockElement.style.display = 'grid';
  blockElement.style.gridTemplateColumns = `repeat(${cols}, 24px)`;
  blockElement.style.gridTemplateRows = `repeat(${rows}, 24px)`;
  blockElement.style.width = `${cols * 24}px`;
  blockElement.style.height = `${rows * 24}px`;
  blockElement.style.gap = '6px';
  blockElement.style.color = block.color;

  const cellMap = new Set(block.cells.map(([x, y]) => `${x},${y}`));

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cell = document.createElement('div');
      if (cellMap.has(`${x},${y}`)) {
        cell.className = 'waiting-block-cell';
      }
      blockElement.appendChild(cell);
    }
  }

  return blockElement;
}

function createFloatingBlockElement(block) {
  const element = document.createElement('div');
  const cols = Math.max(...block.cells.map(([x]) => x)) + 1;
  const rows = Math.max(...block.cells.map(([, y]) => y)) + 1;

  element.className = 'floating-block';
  element.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  element.style.width = `${cols * 28}px`;
  element.style.height = `${rows * 28}px`;
  element.style.color = block.color;

  const cellMap = new Set(block.cells.map(([x, y]) => `${x},${y}`));

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cell = document.createElement('div');
      if (cellMap.has(`${x},${y}`)) {
        cell.className = 'waiting-block-cell';
      }
      element.appendChild(cell);
    }
  }

  document.body.appendChild(element);
  return element;
}

function updateFloatingBlockPosition(clientX, clientY) {
  if (!floatingBlockElement) return;
  floatingBlockElement.style.left = `${clientX}px`;
  floatingBlockElement.style.top = `${clientY}px`;
}

function handleDocumentPointerMove(event) {
  if (!selectedBlock) return;
  updateFloatingBlockPosition(event.clientX, event.clientY);
}

function renderWaitingSlots() {
  const slots = waitingArea.querySelectorAll('.waiting-slot');
  slots.forEach((slot, index) => {
    slot.innerHTML = '';
    slot.classList.remove('waiting-slot--active');
    const block = waitingBlocks[index];
    if (block) {
      slot.appendChild(createWaitingBlockElement(block));
    }
    slot.dataset.slotIndex = index;
  });
}

function handleWaitingPointerDown(event) {
  const slot = event.target.closest('.waiting-slot');
  if (!slot) return;
  const slotIndex = Number(slot.dataset.slotIndex);
  const block = waitingBlocks[slotIndex];
  if (!block) return;

  selectedBlock = block;
  activeSlotIndex = slotIndex;
  slot.classList.add('waiting-slot--active');
  floatingBlockElement = createFloatingBlockElement(block);
  updateFloatingBlockPosition(event.clientX, event.clientY);
  event.preventDefault();
  console.log('Pointer down on block:', block.name, 'slot', slotIndex);
}

function setupWaitingPointerHandler() {
  if (isWaitingPointerListenerAttached) return;
  waitingArea.addEventListener('pointerdown', handleWaitingPointerDown);
  isWaitingPointerListenerAttached = true;
}

function fillEmptyWaitingSlots() {
  waitingBlocks = waitingBlocks.map((block) => block || getRandomBlock());
}

function initializeWaitingBlocks() {
  waitingBlocks = [getRandomBlock(), getRandomBlock(), getRandomBlock()];
  renderWaitingSlots();
}

function initializeBoardState() {
  boardState = Array.from({ length: 10 }, () => Array(10).fill(null));
}

function handleDocumentPointerUp(event) {
  if (selectedBlock) {
    const boardCell = getBoardCellFromPoint(event.clientX, event.clientY);
    if (boardCell) {
      const isValid = canPlaceBlockAt(boardCell.row, boardCell.col, selectedBlock);
      if (isValid) {
        placeBlockAt(boardCell.row, boardCell.col, selectedBlock);
        waitingBlocks[activeSlotIndex] = null;
        fillEmptyWaitingSlots();
        renderWaitingSlots();

        const clearedLines = clearCompletedLines();
        if (clearedLines > 0) {
          addScore(clearedLines * 120);
        } else {
          addScore(15);
        }
      }
      console.log('Placement check at', boardCell.row, boardCell.col, 'valid:', isValid);
    }
  }

  if (activeSlotIndex !== null) {
    const slot = waitingArea.querySelector(`.waiting-slot[data-slot-index='${activeSlotIndex}']`);
    if (slot) slot.classList.remove('waiting-slot--active');
  }

  if (floatingBlockElement) {
    floatingBlockElement.remove();
    floatingBlockElement = null;
  }

  selectedBlock = null;
  activeSlotIndex = null;
}

function initializeGame() {
  currentScore = 0;
  scoreValue.textContent = '0';
  highscoreValue.textContent = localStorage.getItem('block-blast-highscore') || '0';

  initializeBoardState();
  createBoardCells();
  renderBoard();
  initializeWaitingBlocks();
  setupWaitingPointerHandler();
  if (previewContext && previewCanvas) {
    previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  }
}

window.addEventListener('DOMContentLoaded', initializeGame);
restartButton.addEventListener('click', initializeGame);
document.addEventListener('pointerup', handleDocumentPointerUp);
document.addEventListener('pointermove', handleDocumentPointerMove);
