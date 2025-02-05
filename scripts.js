let numRows = 20; // 行数
let numCols = 20; // 列数
let selectedColor = '#ff0000';
let selectedStitch = 'knit';
let grid = [];

// 保存されたグリッドの状態を読み出す関数
function loadGridState() {
  const saved = localStorage.getItem('knittingChartData');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data && data.numRows && data.numCols && data.grid) {
        numRows = data.numRows;
        numCols = data.numCols;
        grid = data.grid;
        // 入力欄にも反映
        document.getElementById('grid-rows-input').value = numRows;
        document.getElementById('grid-cols-input').value = numCols;
      }
    } catch (e) {
      console.error("保存されたデータの読み込みに失敗しました", e);
    }
  }
}

// 現在のグリッド状態を localStorage に保存する関数
function saveGridState() {
  const data = { numRows, numCols, grid };
  localStorage.setItem('knittingChartData', JSON.stringify(data));
}

// 行・列ラベルの更新（グリッドサイズ変更時に数字を常に表示）
function updateGridLabels() {
    // 上部と下部のラベル（列番号）の更新
    const gridTopLabels = document.getElementById('grid-top-labels');
    const gridBottomLabels = document.getElementById('grid-bottom-labels');
    gridTopLabels.innerHTML = '';
    gridBottomLabels.innerHTML = '';
  
    // 列数に合わせたグリッド設定
    gridTopLabels.style.gridTemplateColumns = `repeat(${numCols}, var(--cell-size))`;
    gridBottomLabels.style.gridTemplateColumns = `repeat(${numCols}, var(--cell-size))`;
  
    for (let j = 0; j < numCols; j++) {
      const topLabel = document.createElement('div');
      // 右から左へ番号を割り当てる（右端を1にする）
      topLabel.textContent = numCols - j;
      gridTopLabels.appendChild(topLabel);
  
      const bottomLabel = document.createElement('div');
      // 右から左へ番号を割り当てる（右端を1にする）
      bottomLabel.textContent = numCols - j;
      gridBottomLabels.appendChild(bottomLabel);
    }
  
    // 左側と右側のラベル（行番号）の更新
    const gridLeftLabels = document.getElementById('grid-left-labels');
    const gridRightLabels = document.getElementById('grid-right-labels');
    gridLeftLabels.innerHTML = '';
    gridRightLabels.innerHTML = '';
  
    gridLeftLabels.style.gridTemplateRows = `repeat(${numRows}, var(--cell-size))`;
    gridRightLabels.style.gridTemplateRows = `repeat(${numRows}, var(--cell-size))`;
  
    for (let i = 0; i < numRows; i++) {
      const leftLabel = document.createElement('div');
      // 下から上へ番号を割り当てる（下端を1にする）
      leftLabel.textContent = numRows - i;
      gridLeftLabels.appendChild(leftLabel);
  
      const rightLabel = document.createElement('div');
      // 下から上へ番号を割り当てる（下端を1にする）
      rightLabel.textContent = numRows - i;
      gridRightLabels.appendChild(rightLabel);
    }
}

// タッチムーブ時の処理関数
function handleCellTouchMove(e) {
  // 標準のスクロール動作を抑止（必要に応じて）
  e.preventDefault();
  // 長押しタイマーをクリアして、長押しによるクリア操作をキャンセル
  clearTimeout(touchTimer);
  const cell = e.currentTarget;
  const row = parseInt(cell.dataset.row);
  const col = parseInt(cell.dataset.col);
  // すでに同じ記号が設定されている場合は何もしない
  if (grid[row][col].type !== selectedStitch) {
    grid[row][col] = {
      type: selectedStitch,
      color: selectedColor
    };
    updateCellDisplay(cell);
    saveGridState();
  }
}

// グリッドの初期化
function initGrid() {
  const container = document.getElementById('grid-container');
  container.innerHTML = '';
  container.style.gridTemplateColumns = `repeat(${numCols}, var(--cell-size))`;

  // gridが未定義なら空の配列を作成
  if (!grid) {
    grid = [];
  }
  // 各行・列について既存の内容を保持しつつ不足分を補う処理
  for (let i = 0; i < numRows; i++) {
    if (!grid[i]) {
      grid[i] = [];
    }
    for (let j = 0; j < numCols; j++) {
      if (!grid[i][j]) {
        grid[i][j] = { type: 'empty', color: '#ffffff' };
      }
    }
  }

  // グリッド本体のセル生成
  for (let i = 0; i < numRows; i++) {
    for (let j = 0; j < numCols; j++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = i;
      cell.dataset.col = j;

      // 列番号に応じた背景色のクラス
      cell.classList.add(j % 2 === 0 ? 'even-col' : 'odd-col');

      cell.addEventListener('click', handleCellClick);
      cell.addEventListener('contextmenu', clearCell); // 必要なら右クリックでのクリアも残す

      // 【ここでは touch イベントの登録は削除】

      cell.appendChild(createStitchSymbol(grid[i][j].type));
      container.appendChild(cell);
      updateCellDisplay(cell);
    }
  }
  updateGridLabels();
  saveGridState();
}

// セルに表示するステッチ記号の作成
function createStitchSymbol(type) {
  const symbol = document.createElement('div');
  symbol.className = 'stitch-symbol';
  symbol.innerHTML = getStitchSymbol(type);
  return symbol;
}

// セルクリック時の処理
function handleCellClick(e) {
  const cell = e.currentTarget;
  const row = parseInt(cell.dataset.row);
  const col = parseInt(cell.dataset.col);

  // すでに同じ記号がセットされている場合はクリア、それ以外の場合は新たな記号をセット
  if (grid[row][col].type === selectedStitch) {
    grid[row][col] = { type: 'empty', color: '#ffffff' };
  } else {
    grid[row][col] = {
      type: selectedStitch,
      color: selectedColor
    };
  }
  updateCellDisplay(cell);
  saveGridState();
}

// セルの表示更新
function updateCellDisplay(cell) {
  const symbol = cell.querySelector('.stitch-symbol');
  const cellData = grid[cell.dataset.row][cell.dataset.col];
  symbol.innerHTML = getStitchSymbol(cellData.type);
  symbol.style.color = cellData.color;
}

// // 右クリックでセルをクリアする処理
// function clearCell(e) {
//   e.preventDefault(); // コンテキストメニューを表示させない
//   const cell = e.currentTarget;
//   const row = parseInt(cell.dataset.row);
//   const col = parseInt(cell.dataset.col);
//   grid[row][col] = { type: 'empty', color: '#ffffff' };
//   updateCellDisplay(cell);
//   saveGridState();
// }

// スマホ用：タッチ開始で長押しタイマーを開始
function handleTouchStart(e) {
  const cell = e.currentTarget;
  // 長押し判定（800ms以上でクリア）
  touchTimer = setTimeout(() => {
    clearCell(e);
  }, 800);
}

// スマホ用：タッチ解除でタイマーをクリア
function handleTouchEnd(e) {
  clearTimeout(touchTimer);
}

// 各ステッチ記号の取得
// function getStitchSymbol(type) {
//   switch (type) {
//     case 'knit': return '─';
//     case 'purl': return '○';
//     case 'yo': return '△';
//     case 'right_up_two_one': return '↗2';
//     case 'left_up_two_one': return '↖2';
//     case 'purl_left_up_two_one': return '↰2';
//     case 'middle_up_three_one': return '⇧3';
//     case 'right_up_three_one': return '↗3';
//     case 'left_up_three_one': return '↖3';
//     case 'right_up_two_cross': return '↗2×';
//     case 'left_up_two_cross': return '↖2×';
//     case 'slip_stitch': return '∿';
//     case 'twist_stitch': return '↻';
//     default: return '';
//   }
// }

function getStitchSymbol(type) {
  if (type === 'empty') {
    return '';
  }
  return `<img src="svg/${type}.svg" style="width: 100%; height:100%;" alt="${type}" />`;
}

// 画像保存機能（html2canvas 必須）
function downloadChart() {
    html2canvas(document.querySelector("#grid-wrapper")).then(canvas => {
      const link = document.createElement('a');
      link.download = 'knitting-chart.png';
      link.href = canvas.toDataURL();
      link.click();
    });
  }

// 全体クリア機能
function clearGrid() {
  // 全体クリア時は、グリッドを空にして再生成
  grid = [];
  initGrid();
  saveGridState();
}

// グリッドサイズ更新関数（行数・列数を個別に更新）
function updateGridSize() {
  const rowsInput = document.getElementById('grid-rows-input');
  const colsInput = document.getElementById('grid-cols-input');
  const newRows = parseInt(rowsInput.value);
  const newCols = parseInt(colsInput.value);
  if (!isNaN(newRows) && newRows > 0 && !isNaN(newCols) && newCols > 0) {
    numRows = newRows;
    numCols = newCols;
    // サイズ変更時は新たにグリッドを初期化
    initGrid();
    saveGridState();
  } else {
    alert('正しい行数・列数を入力してください');
  }
}

// イベントリスナーの設定
document.getElementById('color-picker').addEventListener('input', (e) => {
  selectedColor = e.target.value;
});
document.getElementById('stitch-type').addEventListener('change', (e) => {
  selectedStitch = e.target.value;
});
document.getElementById('update-grid-size').addEventListener('click', updateGridSize);

// ページ読み込み時に保存済みのデータがあれば読み込み、グリッドを生成
loadGridState();
initGrid();

function updateGridSize() {
    const rowsInput = document.getElementById('grid-rows-input');
    const colsInput = document.getElementById('grid-cols-input');
    const newRows = parseInt(rowsInput.value);
    const newCols = parseInt(colsInput.value);
    if (!isNaN(newRows) && newRows > 0 && !isNaN(newCols) && newCols > 0) {
      // 行数が少なくなる場合は、grid配列を切り詰める
      if (newRows < numRows) {
        grid = grid.slice(0, newRows);
      }
      // 各行について、列数が少なくなる場合は切り詰める
      for (let i = 0; i < newRows; i++) {
        if (!grid[i]) {
          grid[i] = [];
        }
        if (newCols < numCols) {
          grid[i] = grid[i].slice(0, newCols);
        }
      }
      numRows = newRows;
      numCols = newCols;
      initGrid();
      saveGridState();
    } else {
      alert('正しい行数・列数を入力してください');
    }
  }

// ============================
// 方向指定で行・列を追加／削除する新機能
// ============================

// 上に行を追加する機能
function addRowTop() {
    numRows++;
    let newRow = [];
    for (let j = 0; j < numCols; j++) {
      newRow.push({ type: 'empty', color: '#ffffff' });
    }
    grid.unshift(newRow); // 先頭に新しい行を追加
    document.getElementById('grid-rows-input').value = numRows;
    initGrid();
    saveGridState();
  }
  
  // 下に行を追加する機能（元の addRow() の機能を利用）
  function addRowBottom() {
    numRows++;
    let newRow = [];
    for (let j = 0; j < numCols; j++) {
      newRow.push({ type: 'empty', color: '#ffffff' });
    }
    grid.push(newRow);
    document.getElementById('grid-rows-input').value = numRows;
    initGrid();
    saveGridState();
  }
  
  // 左に列を追加する機能
  function addColumnLeft() {
    numCols++;
    for (let i = 0; i < numRows; i++) {
      grid[i].unshift({ type: 'empty', color: '#ffffff' });
    }
    document.getElementById('grid-cols-input').value = numCols;
    initGrid();
    saveGridState();
  }
  
  // 右に列を追加する機能（元の addColumn() の機能を利用）
  function addColumnRight() {
    numCols++;
    for (let i = 0; i < numRows; i++) {
      grid[i].push({ type: 'empty', color: '#ffffff' });
    }
    document.getElementById('grid-cols-input').value = numCols;
    initGrid();
    saveGridState();
  }
  
  // 上から行を削除する機能
  function removeRowTop() {
    if (numRows <= 1) {
      alert('最低1行は必要です');
      return;
    }
    numRows--;
    grid.shift(); // 先頭の行を削除
    document.getElementById('grid-rows-input').value = numRows;
    initGrid();
    saveGridState();
  }
  
  // 下から行を削除する機能
  function removeRowBottom() {
    if (numRows <= 1) {
      alert('最低1行は必要です');
      return;
    }
    numRows--;
    grid.pop(); // 最後の行を削除
    document.getElementById('grid-rows-input').value = numRows;
    initGrid();
    saveGridState();
  }
  
  // 左から列を削除する機能
  function removeColumnLeft() {
    if (numCols <= 1) {
      alert('最低1列は必要です');
      return;
    }
    numCols--;
    for (let i = 0; i < numRows; i++) {
      grid[i].shift(); // 各行の先頭セルを削除
    }
    document.getElementById('grid-cols-input').value = numCols;
    initGrid();
    saveGridState();
  }
  
  // 右から列を削除する機能
  function removeColumnRight() {
    if (numCols <= 1) {
      alert('最低1列は必要です');
      return;
    }
    numCols--;
    for (let i = 0; i < numRows; i++) {
      grid[i].pop(); // 各行の最後のセルを削除
    }
    document.getElementById('grid-cols-input').value = numCols;
    initGrid();
    saveGridState();
  }



// ============================
// 以下、ドラッグによる記号入力の実装
// ============================

// ドラッグ中の状態を管理するフラグ
let isDragging = false;

// ドラッグ中にセルへ記号を適用する共通処理
function applyStitchToCell(cell) {
  const row = parseInt(cell.dataset.row);
  const col = parseInt(cell.dataset.col);
  if (grid[row][col].type !== selectedStitch) {
    grid[row][col] = {
      type: selectedStitch,
      color: selectedColor
    };
    updateCellDisplay(cell);
    saveGridState();
  }
}


// グリッドコンテナに pointer イベントを設定
const gridContainer = document.getElementById('grid-container');

gridContainer.addEventListener('pointerdown', (e) => {
  // クリック・タッチ開始時に対象セルを取得
  let cell = e.target;
  if (!cell.classList.contains('cell')) {
    cell = cell.closest('.cell');
  }
  if (cell) {
    isDragging = true;
    applyStitchToCell(cell);
  }
});

gridContainer.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  // 指の位置から要素を取得
  const element = document.elementFromPoint(e.clientX, e.clientY);
  if (!element) return;
  let cell = element;
  if (!cell.classList.contains('cell')) {
    cell = cell.closest('.cell');
  }
  if (cell) {
    applyStitchToCell(cell);
  }
});

// ドラッグ終了時にフラグをリセット
gridContainer.addEventListener('pointerup', () => {
  isDragging = false;
});
gridContainer.addEventListener('pointercancel', () => {
  isDragging = false;
});

// イベントリスナーの設定（カラーピッカー、ステッチタイプ、グリッドサイズ更新など）
document.getElementById('color-picker').addEventListener('input', (e) => {
  selectedColor = e.target.value;
});
document.getElementById('stitch-type').addEventListener('change', (e) => {
  selectedStitch = e.target.value;
});
document.getElementById('update-grid-size').addEventListener('click', updateGridSize);