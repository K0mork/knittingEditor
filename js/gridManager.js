export class GridManager {
    constructor(options = {}) {
      // DOM要素の取得
      this.container = document.getElementById('grid-container');
      this.topLabels = document.getElementById('grid-top-labels');
      this.bottomLabels = document.getElementById('grid-bottom-labels');
      this.leftLabels = document.getElementById('grid-left-labels');
      this.rightLabels = document.getElementById('grid-right-labels');
      this.rowsInput = document.getElementById('grid-rows-input');
      this.colsInput = document.getElementById('grid-cols-input');
  
      // 初期状態
      this.numRows = options.numRows || 20;
      this.numCols = options.numCols || 20;
      this.grid = options.grid || [];
      this.selectedColor = options.selectedColor || '#ff0000';
      this.selectedStitch = options.selectedStitch || 'knit';
  
      // 状態変化時のコールバック
      this.onStateChange = options.onStateChange || function(){};
  
      // タッチ用タイマー
      this.touchTimer = null;
  
      // グリッド初期化
      this._initializeGrid();
    }
  
    _initializeGrid() {
      // grid 配列の初期化（不足部分を補完）
      for (let i = 0; i < this.numRows; i++) {
        if (!this.grid[i]) {
          this.grid[i] = [];
        }
        for (let j = 0; j < this.numCols; j++) {
          if (!this.grid[i][j]) {
            this.grid[i][j] = { type: 'empty', color: '#ffffff' };
          }
        }
      }
      this.renderGrid();
    }
  
    getGridData() {
      return {
        numRows: this.numRows,
        numCols: this.numCols,
        grid: this.grid
      };
    }
  
    renderGrid() {
      // グリッド本体の描画
      this.container.innerHTML = '';
      this.container.style.gridTemplateColumns = `repeat(${this.numCols}, var(--cell-size))`;
  
      for (let i = 0; i < this.numRows; i++) {
        for (let j = 0; j < this.numCols; j++) {
          const cell = this._createCell(i, j);
          this.container.appendChild(cell);
          this.updateCellDisplay(cell);
        }
      }
      this.updateGridLabels();
      // 入力欄の更新
      this.rowsInput.value = this.numRows;
      this.colsInput.value = this.numCols;
      // 状態更新コールバックの呼び出し
      this.onStateChange(this.getGridData());
    }
  
    _createCell(row, col) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      // 偶数・奇数列で背景色をクラス付与
      cell.classList.add(col % 2 === 0 ? 'even-col' : 'odd-col');
  
      // イベント登録
      cell.addEventListener('click', (e) => this.handleCellClick(e));
      cell.addEventListener('contextmenu', (e) => this.handleClearCell(e));
      cell.addEventListener('touchstart', (e) => this.handleTouchStart(e));
      cell.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
      cell.addEventListener('touchend', (e) => this.handleTouchEnd(e));
  
      // セル内に記号表示要素
      const symbol = document.createElement('div');
      symbol.className = 'stitch-symbol';
      cell.appendChild(symbol);
  
      return cell;
    }
  
    updateCellDisplay(cell) {
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      const cellData = this.grid[row][col];
      const symbolElem = cell.querySelector('.stitch-symbol');
      symbolElem.innerHTML = this.getStitchSymbol(cellData.type);
      symbolElem.style.color = cellData.color;
    }
  
    getStitchSymbol(type) {
      if (type === 'empty') return '';
      return `<img src="svg/${type}.svg" alt="${type}" style="width:100%;height:100%;" />`;
    }
  
    updateGridLabels() {
      // 上・下ラベル（列番号）
      this.topLabels.innerHTML = '';
      this.bottomLabels.innerHTML = '';
      this.topLabels.style.gridTemplateColumns = `repeat(${this.numCols}, var(--cell-size))`;
      this.bottomLabels.style.gridTemplateColumns = `repeat(${this.numCols}, var(--cell-size))`;
      for (let j = 0; j < this.numCols; j++) {
        const labelText = this.numCols - j;
        const topLabel = document.createElement('div');
        topLabel.textContent = labelText;
        this.topLabels.appendChild(topLabel);
  
        const bottomLabel = document.createElement('div');
        bottomLabel.textContent = labelText;
        this.bottomLabels.appendChild(bottomLabel);
      }
  
      // 左・右ラベル（行番号）
      this.leftLabels.innerHTML = '';
      this.rightLabels.innerHTML = '';
      this.leftLabels.style.gridTemplateRows = `repeat(${this.numRows}, var(--cell-size))`;
      this.rightLabels.style.gridTemplateRows = `repeat(${this.numRows}, var(--cell-size))`;
      for (let i = 0; i < this.numRows; i++) {
        const labelText = this.numRows - i;
        const leftLabel = document.createElement('div');
        leftLabel.textContent = labelText;
        this.leftLabels.appendChild(leftLabel);
  
        const rightLabel = document.createElement('div');
        rightLabel.textContent = labelText;
        this.rightLabels.appendChild(rightLabel);
      }
    }
  
    handleCellClick(e) {
      const cell = e.currentTarget;
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      if (this.grid[row][col].type === this.selectedStitch) {
        this.grid[row][col] = { type: 'empty', color: '#ffffff' };
      } else {
        this.grid[row][col] = { type: this.selectedStitch, color: this.selectedColor };
      }
      this.updateCellDisplay(cell);
      this.onStateChange(this.getGridData());
    }
  
    handleClearCell(e) {
      e.preventDefault();
      const cell = e.currentTarget;
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      this.grid[row][col] = { type: 'empty', color: '#ffffff' };
      this.updateCellDisplay(cell);
      this.onStateChange(this.getGridData());
    }
  
    handleTouchStart(e) {
      const cell = e.currentTarget;
      cell.dataset.startX = e.touches[0].clientX;
      cell.dataset.startY = e.touches[0].clientY;
    }
  
    handleTouchMove(e) {
      const cell = e.currentTarget;
      const startX = parseFloat(cell.dataset.startX);
      const startY = parseFloat(cell.dataset.startY);
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const threshold = 5;
      if (Math.abs(currentX - startX) > threshold || Math.abs(currentY - startY) > threshold) {
        clearTimeout(this.touchTimer);
        return;
      }
      e.preventDefault();
      clearTimeout(this.touchTimer);
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      if (this.grid[row][col].type !== this.selectedStitch) {
        this.grid[row][col] = { type: this.selectedStitch, color: this.selectedColor };
        this.updateCellDisplay(cell);
        this.onStateChange(this.getGridData());
      }
    }
  
    handleTouchEnd(e) {
      clearTimeout(this.touchTimer);
    }
  
    updateGridSize(newRows, newCols) {
      if (newRows > 0 && newCols > 0) {
        if (newRows < this.numRows) {
          this.grid = this.grid.slice(0, newRows);
        }
        for (let i = 0; i < newRows; i++) {
          if (!this.grid[i]) {
            this.grid[i] = [];
          }
          if (newCols < this.numCols) {
            this.grid[i] = this.grid[i].slice(0, newCols);
          }
          while (this.grid[i].length < newCols) {
            this.grid[i].push({ type: 'empty', color: '#ffffff' });
          }
        }
        this.numRows = newRows;
        this.numCols = newCols;
        this.renderGrid();
      } else {
        alert('正しい行数・列数を入力してください');
      }
    }
  
    clearGrid() {
      this.grid = [];
      for (let i = 0; i < this.numRows; i++) {
        const row = [];
        for (let j = 0; j < this.numCols; j++) {
          row.push({ type: 'empty', color: '#ffffff' });
        }
        this.grid.push(row);
      }
      this.renderGrid();
    }
  
    addRowTop() {
      this.numRows++;
      const newRow = [];
      for (let j = 0; j < this.numCols; j++) {
        newRow.push({ type: 'empty', color: '#ffffff' });
      }
      this.grid.unshift(newRow);
      this.renderGrid();
    }
  
    addRowBottom() {
      this.numRows++;
      const newRow = [];
      for (let j = 0; j < this.numCols; j++) {
        newRow.push({ type: 'empty', color: '#ffffff' });
      }
      this.grid.push(newRow);
      this.renderGrid();
    }
  
    removeRowTop() {
      if (this.numRows <= 1) {
        alert('最低1行は必要です');
        return;
      }
      this.numRows--;
      this.grid.shift();
      this.renderGrid();
    }
  
    removeRowBottom() {
      if (this.numRows <= 1) {
        alert('最低1行は必要です');
        return;
      }
      this.numRows--;
      this.grid.pop();
      this.renderGrid();
    }
  
    addColumnLeft() {
      this.numCols++;
      for (let i = 0; i < this.numRows; i++) {
        this.grid[i].unshift({ type: 'empty', color: '#ffffff' });
      }
      this.renderGrid();
    }
  
    addColumnRight() {
      this.numCols++;
      for (let i = 0; i < this.numRows; i++) {
        this.grid[i].push({ type: 'empty', color: '#ffffff' });
      }
      this.renderGrid();
    }
  
    removeColumnLeft() {
      if (this.numCols <= 1) {
        alert('最低1列は必要です');
        return;
      }
      this.numCols--;
      for (let i = 0; i < this.numRows; i++) {
        this.grid[i].shift();
      }
      this.renderGrid();
    }
  
    removeColumnRight() {
      if (this.numCols <= 1) {
        alert('最低1列は必要です');
        return;
      }
      this.numCols--;
      for (let i = 0; i < this.numRows; i++) {
        this.grid[i].pop();
      }
      this.renderGrid();
    }
  
    setSelectedColor(color) {
      this.selectedColor = color;
    }
  
    setSelectedStitch(stitch) {
      this.selectedStitch = stitch;
    }
  }