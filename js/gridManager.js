import { getStitchSymbol } from './stitchSymbols.js';

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
  
    /* ヘルパーメソッド */
    _createEmptyCell() {
      return { type: 'empty', color: '#ffffff' };
    }
    _createEmptyRow(cols) {
      return Array.from({ length: cols }, () => this._createEmptyCell());
    }
  
    _initializeGrid() {
      // grid 配列の初期化（不足部分を補完）
      for (let i = 0; i < this.numRows; i++) {
        if (!this.grid[i]) {
          this.grid[i] = [];
        }
        for (let j = 0; j < this.numCols; j++) {
          if (!this.grid[i][j]) {
            this.grid[i][j] = this._createEmptyCell();
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
      // 横方向の縞模様：奇数・偶数行で背景色をクラス付与
      cell.classList.add(row % 2 === 0 ? 'even-col' : 'odd-col');
  
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

      // もしセルが erase 状態なら、背景と枠線を白にして記号表示をクリア
      if (cellData.type === 'erase') {
        cell.style.backgroundColor = '#ffffff';
        cell.style.border = '1px solid #ffffff';
        symbolElem.innerHTML = '';
        return;
      }

      // 継続セル（連結されているセル）の処理
      if (cellData && (cellData.isContinuation || cellData.isContinuationVertical)) {
        cell.classList.add("merged-cell");
        symbolElem.innerHTML = '';
        return;
      } else {
        cell.classList.remove("merged-cell");
      }

      let svgMarkup = getStitchSymbol(cellData.type);
      if (cellData && cellData.multi) {
        // メインセルの場合（多セル記号の場合）は、横幅を span 個分（例：2または3）に拡大、縦は1マスに設定
        let span = cellData.multi;
        symbolElem.innerHTML = svgMarkup;
        symbolElem.style.width = `calc(${span} * var(--cell-size))`;
        symbolElem.style.height = '100%';
        symbolElem.style.position = 'absolute';
        symbolElem.style.left = '0';
        symbolElem.style.top = '0';
        cell.style.position = 'relative';
        // メインセルの右境界線を除去して連結感を演出
        cell.style.borderRight = 'none';

        // SVG のアスペクト比維持を解除して横に伸ばす
        const svgElem = symbolElem.querySelector('svg');
        if (svgElem) {
          svgElem.setAttribute('preserveAspectRatio', 'none');
        }
      } else if (cellData && cellData.verticalSpan) {
        // すべり目（slip_stitch）の場合：縦に2マス、横は1マス
        let vSpan = cellData.verticalSpan;
        symbolElem.innerHTML = svgMarkup;
        symbolElem.style.width = '100%';
        symbolElem.style.height = `calc(${vSpan} * var(--cell-size))`;
        symbolElem.style.position = 'absolute';
        symbolElem.style.left = '0';
        symbolElem.style.top = '0';
        cell.style.position = 'relative';
        // 下側の境界線を除去して連結感を演出
        cell.style.borderBottom = 'none';
        const svgElem = symbolElem.querySelector('svg');
        if (svgElem) {
          svgElem.setAttribute('preserveAspectRatio', 'none');
        }
      } else {
        // 通常セルはそのまま１セル分のサイズで表示
        symbolElem.innerHTML = svgMarkup;
        symbolElem.style.width = '100%';
        symbolElem.style.height = '100%';
        cell.style.borderRight = '';
        cell.style.borderBottom = '';
        cell.style.position = '';
      }
      symbolElem.style.color = cellData.color || '#000000';
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
  
    // 修正後のセルタップ時の処理（多セル記号の場合、右隣のセルも同時に処理）
    handleCellClick(e) {
      let cell = e.currentTarget;
      let row = parseInt(cell.dataset.row);
      let col = parseInt(cell.dataset.col);

      // ① クリックされたセルが縦方向の継続セルの場合、まずそのセルをクリアしてから
      // 上方向に走査し、メインセル（verticalSpan を持つセル）の位置に切り替える
      if (this.grid[row][col].isContinuationVertical) {
          this.grid[row][col] = this._createEmptyCell();
          for (let r = row; r >= 0; r--) {
              if (this.grid[r][col].verticalSpan) {
                  row = r;
                  break;
              }
          }
      }

      // ② クリックされたセルが縦方向の多セル記号のメインセルである場合、
      // つながっている継続セルもクリアする（※新規配置時に上書きできるようにするため）
      if (this.grid[row][col].verticalSpan) {
          const vSpan = this.grid[row][col].verticalSpan;
          const groupType = this.grid[row][col].type;
          for (let offset = 0; offset < vSpan; offset++) {
              this.grid[row + offset][col] = this._createEmptyCell();
          }
          this.renderGrid();
          // もし既存グループと選択記号が同じであれば、トグル動作としてここで終了
          if (groupType === this.selectedStitch) {
              return;
          }
          // 異なる場合は、クリア後に新たな記号配置処理へ進む
      }

      // ③ クリックされたセルが横方向の継続セルの場合は、左隣のメインセルに切り替える
      if (this.grid[row][col].isContinuation) {
          if (col > 0) {
              col = col - 1;
          }
      }

      // ④ 'erase'（消去）の場合は単一セルとして処理
      if (this.selectedStitch === 'erase') {
          if (this.grid[row][col].type === 'erase') {
              this.grid[row][col] = this._createEmptyCell();
          } else {
              this.grid[row][col] = { type: 'erase', color: '#ffffff' };
          }
          this.renderGrid();
          return;
      }

      // ⑤ すべり目（縦方向多セル記号）の場合の処理
      if (this.selectedStitch === 'slip_stitch') {
          const vSpan = this.getRequiredCellVerticalSpan(this.selectedStitch);
          if (row > this.numRows - vSpan) {
              alert(`このセルは最下部に近いため、縦に${vSpan}セル分の配置ができません`);
              return;
          }
          // 既に同じすべり目が設置されている場合はトグルで削除
          if (this.grid[row][col].type === this.selectedStitch && this.grid[row][col].verticalSpan === vSpan) {
              this.grid[row][col] = this._createEmptyCell();
              for (let offset = 1; offset < vSpan; offset++) {
                  this.grid[row + offset][col] = this._createEmptyCell();
              }
              this.renderGrid();
              return;
          } else {
              // 新規配置前に対象セル（メイン＋継続セル）をクリアする
              for (let offset = 0; offset < vSpan; offset++) {
                  this.grid[row + offset][col] = this._createEmptyCell();
              }
              this.grid[row][col] = {
                  type: this.selectedStitch,
                  color: this.selectedColor,
                  verticalSpan: vSpan
              };
              for (let offset = 1; offset < vSpan; offset++) {
                  this.grid[row + offset][col] = {
                      type: 'empty',
                      color: 'transparent',
                      isContinuationVertical: true
                  };
              }
              this.renderGrid();
              return;
          }
      }

      // ⑥ その他（横方向の多セル記号／単セル）の場合
      const span = this.getRequiredCellSpan(this.selectedStitch);
      if (span > 1) {
          let mainCol = col;
          if (this.grid[row][col].isContinuation) {
              mainCol = col - 1;
          }
          
          // ★ ここで、新たに配置される横方向領域内の各セルが縦方向の多セル記号のメインセルであれば、そのグループをクリア
          for (let c = mainCol; c < mainCol + span; c++) {
              if (this.grid[row][c].verticalSpan) {
                  const vSpan = this.grid[row][c].verticalSpan;
                  for (let offset = 0; offset < vSpan; offset++) {
                      this.grid[row + offset][c] = this._createEmptyCell();
                  }
              }
          }

          // トグル動作：既に同じ記号（かつ multi 情報が同じ）ならばグループ全体を消す
          if (this.grid[row][mainCol].type === this.selectedStitch && this.grid[row][mainCol].multi === span) {
              for (let offset = 0; offset < span; offset++) {
                  this.grid[row][mainCol + offset] = this._createEmptyCell();
              }
              this.renderGrid();
              return;
          }

          // 既存の横方向多セルグループと重複する部分のクリア
          const newStart = mainCol;
          const newEnd = mainCol + span - 1;
          for (let c = 0; c < this.numCols; c++) {
              if (this.grid[row][c].multi && this.grid[row][c].multi > 1) {
                  const groupSpan = this.grid[row][c].multi;
                  const groupStart = c;
                  const groupEnd = c + groupSpan - 1;
                  if (groupEnd >= newStart && groupStart <= newEnd) {
                      for (let offset = 0; offset < groupSpan; offset++) {
                          this.grid[row][c + offset] = this._createEmptyCell();
                      }
                  }
              }
          }

          if (mainCol > this.numCols - span) {
              alert(`このセルは右端のため、${span}セル分の記号を配置できません`);
              return;
          }
          // 新規配置前に対象区画（メインセル＋右側の継続セル）を完全にクリアする
          for (let offset = 0; offset < span; offset++) {
              this.grid[row][mainCol + offset] = this._createEmptyCell();
          }
          // 新たに記号を配置
          this.grid[row][mainCol] = { type: this.selectedStitch, color: this.selectedColor, multi: span };
          for (let offset = 1; offset < span; offset++) {
              this.grid[row][mainCol + offset] = { type: 'empty', color: 'transparent', isContinuation: true };
          }
      } else {
          // 単セルの場合、もし対象セルが縦方向の多セル（すべり目）のグループに属していたらグループ全体を先にクリアする
          if (this.grid[row][col].verticalSpan) {
              const vSpan = this.grid[row][col].verticalSpan;
              for (let offset = 0; offset < vSpan; offset++) {
                  this.grid[row + offset][col] = this._createEmptyCell();
              }
          }
          // 既存の横方向多セルの場合のクリア
          if (this.grid[row][col].multi && this.grid[row][col].multi > 1) {
              let oldSpan = this.grid[row][col].multi;
              for (let offset = 0; offset < oldSpan; offset++) {
                  this.grid[row][col + offset] = this._createEmptyCell();
              }
          }
          // 単セルトグル動作
          if (this.grid[row][col].type === this.selectedStitch) {
              this.grid[row][col] = this._createEmptyCell();
          } else {
              this.grid[row][col] = { type: this.selectedStitch, color: this.selectedColor };
          }
      }
      this.renderGrid();
    }
  
    // 右クリック（またはコンテキストメニュー）によるセルクリア処理
    handleClearCell(e) {
      e.preventDefault();
      const cell = e.currentTarget;
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);

      if (this.grid[row][col].isContinuation) {
        // 継続セルの場合は左側セルもクリア
        if (col > 0 && this.getRequiredCellSpan(this.grid[row][col - 1].type) > 1) {
          this.grid[row][col - 1] = this._createEmptyCell();
          this.grid[row][col] = this._createEmptyCell();
        }
      } else if (this.getRequiredCellSpan(this.grid[row][col].type) > 1 && this.grid[row][col].multi) {
        // メインセルの場合は右隣の継続セルもクリア
        this.grid[row][col] = this._createEmptyCell();
        for (let offset = 1; offset < this.getRequiredCellSpan(this.grid[row][col].type); offset++) {
          if (col < this.numCols - offset && this.grid[row][col + offset].isContinuation) {
            this.grid[row][col + offset] = this._createEmptyCell();
          }
        }
      } else {
        this.grid[row][col] = this._createEmptyCell();
      }
      this.renderGrid();
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
      const span = this.getRequiredCellSpan(this.selectedStitch);

      if (span > 1) {
        if (col > this.numCols - span) return;
        // 既にマルチセル記号が配置されていないか確認
        if (!(this.grid[row][col].type === this.selectedStitch && this.grid[row][col].multi === span)) {
          for (let offset = 1; offset < span; offset++) {
            if (this.grid[row][col + offset].type !== 'empty' || this.grid[row][col + offset].isContinuation) {
              return;
            }
          }
          this.grid[row][col] = { type: this.selectedStitch, color: this.selectedColor, multi: span };
          for (let offset = 1; offset < span; offset++) {
            this.grid[row][col + offset] = { type: 'empty', color: 'transparent', isContinuation: true };
          }
          this.renderGrid();
        }
      } else {
        if (this.grid[row][col].type !== this.selectedStitch) {
          if (this.selectedStitch === 'erase') {
            this.grid[row][col] = { type: 'erase', color: '#ffffff' };
          } else {
            this.grid[row][col] = { type: this.selectedStitch, color: this.selectedColor };
          }
          this.renderGrid();
        }
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
            this.grid[i].push(this._createEmptyCell());
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
        this.grid.push(this._createEmptyRow(this.numCols));
      }
      this.renderGrid();
    }
  
    addRowTop() {
      this.numRows++;
      const newRow = this._createEmptyRow(this.numCols);
      this.grid.unshift(newRow);
      this.renderGrid();
    }
  
    addRowBottom() {
      this.numRows++;
      const newRow = this._createEmptyRow(this.numCols);
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
        this.grid[i].unshift(this._createEmptyCell());
      }
      this.renderGrid();
    }
  
    addColumnRight() {
      this.numCols++;
      for (let i = 0; i < this.numRows; i++) {
        this.grid[i].push(this._createEmptyCell());
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

    // 指定した位置に新しい行を挿入する
    insertRowAt(index) {
      const newRow = this._createEmptyRow(this.numCols);
      this.grid.splice(index, 0, newRow);
      this.numRows++;
      this.renderGrid();
    }

    // 指定した位置に新しい列を挿入する
    insertColumnAt(index) {
      for (let i = 0; i < this.numRows; i++) {
        this.grid[i].splice(index, 0, this._createEmptyCell());
      }
      this.numCols++;
      this.renderGrid();
    }
  
    setSelectedColor(color) {
      this.selectedColor = color;
    }
  
    setSelectedStitch(stitch) {
      this.selectedStitch = stitch;
    }

    // 指定の内部インデックスの行を削除するメソッド
    removeRowAt(index) {
      if (this.numRows <= 1) {
        alert('最低1行は必要です');
        return;
      }
      if (index < 0 || index >= this.numRows) {
        alert('指定された行は存在しません');
        return;
      }
      this.grid.splice(index, 1);
      this.numRows--;
      this.renderGrid();
    }

    // 指定の内部インデックスの列を削除するメソッド
    removeColumnAt(index) {
      if (this.numCols <= 1) {
        alert('最低1列は必要です');
        return;
      }
      if (index < 0 || index >= this.numCols) {
        alert('指定された列は存在しません');
        return;
      }
      for (let i = 0; i < this.numRows; i++) {
        this.grid[i].splice(index, 1);
      }
      this.numCols--;
      this.renderGrid();
    }

    // 必要なセルの横方向のマス数を返す（例：2セル、3セルなど）
    getRequiredCellSpan(stitch) {
      if (stitch === 'right_up_two_cross' || stitch === 'left_up_two_cross') {
        return 4;
      }
      const twoCellSymbols = ['right_up_two_one', 'left_up_two_one', 'purl_left_up_two_one'];
      const threeCellSymbols = ['middle_up_three_one', 'right_up_three_one', 'left_up_three_one'];
      if (twoCellSymbols.includes(stitch)) return 2;
      if (threeCellSymbols.includes(stitch)) return 3;
      return 1;
    }

    // すべり目（slip_stitch）は縦に2セル分使用する
    getRequiredCellVerticalSpan(stitch) {
      if (stitch === 'slip_stitch') return 2;
      return 1;
    }
  }