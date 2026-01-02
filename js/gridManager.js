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
  
      // セル DOM 要素のキャッシュ用配列
      this.cellElements = [];
  
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
      // グリッドのサイズが変化した場合は再構築し、そうでなければキャッシュ済みセルを更新する
      const needsRowRebuild = !this.cellElements || this.cellElements.length !== this.numRows;
      const needsColRebuild = !needsRowRebuild && this.cellElements[0] && this.cellElements[0].length !== this.numCols;

      if (needsRowRebuild || needsColRebuild) {
        // 再構築フェーズ（行または列数が変わった場合）
        this.container.innerHTML = '';
        this.cellElements = [];
        this.container.style.gridTemplateColumns = `repeat(${this.numCols}, var(--cell-size))`;
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < this.numRows; i++) {
          this.cellElements[i] = [];
          for (let j = 0; j < this.numCols; j++) {
            const cell = this._createCell(i, j);
            this.cellElements[i][j] = cell;
            this.updateCellDisplay(cell);
            fragment.appendChild(cell);
          }
        }
        this.container.appendChild(fragment);
      } else {
        // 部分更新フェーズ：キャッシュ済みセルの表示だけを更新
        for (let i = 0; i < this.numRows; i++) {
          for (let j = 0; j < this.numCols; j++) {
            if (this.cellElements[i] && this.cellElements[i][j]) {
              this.updateCellDisplay(this.cellElements[i][j]);
            }
          }
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

      if (cellData.type === 'erase') {
        cell.style.backgroundColor = '#ffffff';
        cell.style.border = '1px solid #ffffff';
        symbolElem.innerHTML = '';
        return;
      }
      
      // もしセルが空で、かつ bgColor が指定されていれば、その背景色・枠線を適用
      if (cellData.type === 'empty' && cellData.bgColor) {
        cell.style.backgroundColor = cellData.bgColor;
        if (cellData.border) {
            cell.style.border = cellData.border;
        } else {
            cell.style.border = ''; // 必要に応じたデフォルト値
        }
      } else {
          // 既存の処理に沿った背景色の設定
          cell.style.backgroundColor = '';
      }

      // 継続セルの処理：横方向と縦方向で区別する
      if (cellData && cellData.isContinuation) {
          // 横方向の継続セル：シンボルは非表示とし、左側の枠線のみ除去して連結感を演出
          cell.classList.add("merged-cell-horizontal");
          symbolElem.innerHTML = '';
          return;
      } else if (cellData && cellData.isContinuationVertical) {
          // 縦方向の継続セルは従来通り全体の枠線を除去
          cell.classList.add("merged-cell-vertical");
          symbolElem.innerHTML = '';
          return;
      } else {
          cell.classList.remove("merged-cell-horizontal");
          cell.classList.remove("merged-cell-vertical");
      }

      let svgMarkup = getStitchSymbol(cellData.type);
      if (cellData && cellData.multi) {
        // メインセルの場合（横長記号の場合）：横幅を span 個分に拡大、縦は 1 マス
        let span = cellData.multi;
        symbolElem.innerHTML = svgMarkup;
        symbolElem.style.width = `calc(${span} * var(--cell-size))`;
        symbolElem.style.height = '100%';
        symbolElem.style.position = 'absolute';
        symbolElem.style.left = '0';
        symbolElem.style.top = '0';
        cell.style.position = 'relative';
        // メインセルの右境界線を除去して連結感を演出
        // cell.style.borderRight = 'none';

        // SVG のアスペクト比維持を解除して横に伸ばす
        const svgElem = symbolElem.querySelector('svg');
        if (svgElem) {
          svgElem.setAttribute('preserveAspectRatio', 'none');
        }
      } else if (cellData && cellData.verticalSpan) {
        // すべり目（slip_stitch）の場合：縦に複数セル分、横は1セル
        let vSpan = cellData.verticalSpan;
        symbolElem.innerHTML = svgMarkup;
        symbolElem.style.width = '100%';
        symbolElem.style.height = `calc(${vSpan} * var(--cell-size))`;
        symbolElem.style.position = 'absolute';
        symbolElem.style.left = '0';
        symbolElem.style.top = '0';
        cell.style.position = 'relative';
        // 下側の境界線を除去
        cell.style.borderBottom = 'none';
        const svgElem = symbolElem.querySelector('svg');
        if (svgElem) {
          svgElem.setAttribute('preserveAspectRatio', 'none');
        }
      } else {
        // 通常セルの表示：1セル分のサイズ
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
      // クリックされたセルの位置
      const clickedRow = parseInt(e.currentTarget.dataset.row);
      const clickedCol = parseInt(e.currentTarget.dataset.col);
      // 選択記号の横方向必要セル数を取得（単セルなら 1, 横長記号なら 2以上）
      const hSpan = this.getRequiredCellSpan(this.selectedStitch);

      // 単セル（1マス記号、すべり目以外）の場合は、クリックされた位置そのままで上書き可能にする
      if (hSpan === 1 && this.selectedStitch !== 'slip_stitch') {
          let row = clickedRow;
          let col = clickedCol;
          
          // ★ 縦方向のグループに属している場合（メインセル or 継続セル）、
          // そのグループ全体（メイン＋下側の継続セル）をクリアする
          if (this.grid[row][col].isContinuationVertical) {
              // 継続セルの場合、上方向に走査してメインセルを特定
              let mainRow = row;
              for (let r = row; r >= 0; r--) {
                  if (this.grid[r][col].verticalSpan) {
                      mainRow = r;
                      break;
                  }
              }
              const groupVSpan = this.grid[mainRow][col].verticalSpan;
              if (groupVSpan) {
                  for (let offset = 0; offset < groupVSpan; offset++) {
                      this.grid[mainRow + offset][col] = this._createEmptyCell();
                  }
              }
          } else if (this.grid[row][col].verticalSpan) {
              // クリック位置そのものが縦方向の多セル記号のメインセルの場合
              const groupVSpan = this.grid[row][col].verticalSpan;
              for (let offset = 0; offset < groupVSpan; offset++) {
                  this.grid[row + offset][col] = this._createEmptyCell();
              }
          }
          
          // ★ 横方向のグループに属している場合（メインセル or 継続セル）、
          // そのグループ全体（メイン＋右側の継続セル）をクリアする
          if (this.grid[row][col].isContinuation) {
              // 継続セルの場合、左方向に走査してメインセルを特定
              let mainCol = col;
              for (let c = col; c >= 0; c--) {
                  if (this.grid[row][c].multi && !this.grid[row][c].isContinuation) {
                      mainCol = c;
                      break;
                  }
              }
              const groupHSpan = this.grid[row][mainCol].multi;
              if (groupHSpan) {
                  for (let offset = 0; offset < groupHSpan; offset++) {
                      this.grid[row][mainCol + offset] = this._createEmptyCell();
                  }
              }
          } else if (this.grid[row][col].multi && this.grid[row][col].multi > 1) {
              // クリック位置が横方向の多セル記号のメインセルの場合
              let groupHSpan = this.grid[row][col].multi;
              for (let offset = 0; offset < groupHSpan; offset++) {
                  this.grid[row][col + offset] = this._createEmptyCell();
              }
          }
          
          // 単セルの場合、同じ記号ならトグル（=クリア）、異なるなら新たな記号を配置
          if (this.selectedStitch === 'erase') {
            if (this.grid[row][col].type === 'erase') {
              // 既に "erase" 状態の場合、セルをクリア（空セルに）し、行番号に応じた背景色と元のグリッド枠線を再現
              const clearedCell = this._createEmptyCell();
              const rowColor = this.getRowColor(row); // 行番号に応じた色を取得
              clearedCell.bgColor = rowColor;          // 背景色の設定
              clearedCell.border = '1px solid #ddd';
              this.grid[row][col] = clearedCell;
          } else {
                // "erase" 状態を適用する場合の処理
                this.grid[row][col] = { type: 'erase', color: '#ffffff' };
            }
            this.renderGrid();
            return;
        } else {
              if (this.grid[row][col].type === this.selectedStitch) {
                  this.grid[row][col] = this._createEmptyCell();
              } else {
                  this.grid[row][col] = { type: this.selectedStitch, color: this.selectedColor };
              }
          }
          this.renderGrid();
          return;
      }

      // 'erase'（消去）の場合は、対象セルが多セル記号の一部でもグループ全体をクリアして処理
      if (this.selectedStitch === 'erase') {
          // 縦方向のクリア
          if (this.grid[clickedRow][clickedCol].isContinuationVertical) {
              let mainRow = clickedRow;
              for (let r = clickedRow; r >= 0; r--) {
                  if (this.grid[r][clickedCol].verticalSpan) { mainRow = r; break; }
              }
              const groupVSpan = this.grid[mainRow][clickedCol].verticalSpan;
              if (groupVSpan) {
                  for (let offset = 0; offset < groupVSpan; offset++) {
                      this.grid[mainRow + offset][clickedCol] = this._createEmptyCell();
                  }
              }
          }
          // 横方向のクリア
          if (this.grid[clickedRow][clickedCol].isContinuation) {
              let mainCol = clickedCol;
              for (let c = clickedCol; c >= 0; c--) {
                  if (this.grid[clickedRow][c].multi && !this.grid[clickedRow][c].isContinuation) {
                      mainCol = c;
                      break;
                  }
              }
              const groupHSpan = this.grid[clickedRow][mainCol].multi;
              if (groupHSpan) {
                  for (let offset = 0; offset < groupHSpan; offset++) {
                      this.grid[clickedRow][mainCol + offset] = this._createEmptyCell();
                  }
              }
          }
          if (this.grid[clickedRow][clickedCol].type === 'erase') {
              this.grid[clickedRow][clickedCol] = this._createEmptyCell();
          } else {
              this.grid[clickedRow][clickedCol] = { type: 'erase', color: '#ffffff' };
          }
          this.renderGrid();
          return;
      }

      // すべり目（縦方向多セル記号）の場合の処理
      if (this.selectedStitch === 'slip_stitch') {
          let row = clickedRow;
          let col = clickedCol;
          const slipVSpan = this.getRequiredCellVerticalSpan(this.selectedStitch);

          // もしタップされたセル（もしくは継続セルの場合は上方向に走査してメインセル）のすでり目が既に存在していれば削除して終了
          let mainRow = row;
          if (this.grid[row][col].isContinuationVertical) {
              for (let r = row; r >= 0; r--) {
                  if (this.grid[r][col].verticalSpan) {
                      mainRow = r;
                      break;
                  }
              }
          }
          if (this.grid[mainRow][col].type === 'slip_stitch' && this.grid[mainRow][col].verticalSpan === slipVSpan) {
              // すでにすべり目がセットされている場合、グループ全体をクリアして終了
              for (let offset = 0; offset < slipVSpan; offset++) {
                  this.grid[mainRow + offset][col] = this._createEmptyCell();
              }
              this.renderGrid();
              return;
          }

          if (row > this.numRows - slipVSpan) {
              alert(`このセルは最下部に近いため、縦に${slipVSpan}セル分の配置ができません`);
              return;
          }

          // 対象となる縦領域内に重複する横方向グループがあれば、それらをクリアする
          for (let offset = 0; offset < slipVSpan; offset++) {
              let targetCell = this.grid[row + offset][col];
              if (targetCell.multi && targetCell.multi > 1) {
                  let mainCol = col;
                  if (targetCell.isContinuation) {
                      for (let c = col; c >= 0; c--) {
                          if (this.grid[row + offset][c].multi && !this.grid[row + offset][c].isContinuation) {
                              mainCol = c;
                              break;
                          }
                      }
                  }
                  const groupHSpan = this.grid[row + offset][mainCol].multi;
                  for (let c = mainCol; c < mainCol + groupHSpan; c++) {
                      this.grid[row + offset][c] = this._createEmptyCell();
                  }
              } else if (targetCell.isContinuation) {
                  let mainCol = col;
                  for (let c = col; c >= 0; c--) {
                      if (this.grid[row + offset][c].multi && !this.grid[row + offset][c].isContinuation) {
                          mainCol = c;
                          break;
                      }
                  }
                  if (this.grid[row + offset][mainCol].multi) {
                      const groupHSpan = this.grid[row + offset][mainCol].multi;
                      for (let c = mainCol; c < mainCol + groupHSpan; c++) {
                          this.grid[row + offset][c] = this._createEmptyCell();
                      }
                  }
              }
          }

          // 新たにすべり目を配置
          this.grid[row][col] = {
              type: this.selectedStitch,
              color: this.selectedColor,
              verticalSpan: slipVSpan
          };
          for (let offset = 1; offset < slipVSpan; offset++) {
              this.grid[row + offset][col] = {
                  type: 'empty',
                  color: 'transparent',
                  isContinuationVertical: true
              };
          }
          this.renderGrid();
          return;
      }

      // 横方向の多セル記号の場合（span > 1）
      if (hSpan > 1) {
          let row = clickedRow;
          let mainCol = clickedCol;
          if (this.grid[row][clickedCol].isContinuation) {
              mainCol = clickedCol - 1;
          }
          // 対象となる横領域内に重複する縦方向グループがあればクリア
          for (let c = mainCol; c < mainCol + hSpan; c++) {
              if (this.grid[row][c].verticalSpan) {
                  const groupVSpan = this.grid[row][c].verticalSpan;
                  for (let offset = 0; offset < groupVSpan; offset++) {
                      this.grid[row + offset][c] = this._createEmptyCell();
                  }
              } else if (this.grid[row][c].isContinuationVertical) {
                  let mainRow = row;
                  for (let r = row; r >= 0; r--) {
                      if (this.grid[r][c].verticalSpan) {
                          mainRow = r;
                          break;
                      }
                  }
                  const groupVSpan = this.grid[mainRow][c].verticalSpan;
                  for (let offset = 0; offset < groupVSpan; offset++) {
                      this.grid[mainRow + offset][c] = this._createEmptyCell();
                  }
              }
          }
          // トグル動作：既に同じ横長記号が配置されていれば削除
          if (this.grid[row][mainCol].type === this.selectedStitch && this.grid[row][mainCol].multi === hSpan) {
              for (let offset = 0; offset < hSpan; offset++) {
                  this.grid[row][mainCol + offset] = this._createEmptyCell();
              }
              this.renderGrid();
              return;
          }
          // 既存の横方向グループで重複する部分をクリア
          const newStart = mainCol;
          const newEnd = mainCol + hSpan - 1;
          for (let c = 0; c < this.numCols; c++) {
              if (this.grid[row][c].multi && this.grid[row][c].multi > 1) {
                  const groupHSpan = this.grid[row][c].multi;
                  const groupStart = c;
                  const groupEnd = c + groupHSpan - 1;
                  if (groupEnd >= newStart && groupStart <= newEnd) {
                      for (let offset = 0; offset < groupHSpan; offset++) {
                          this.grid[row][c + offset] = this._createEmptyCell();
                      }
                  }
              }
          }
          if (mainCol > this.numCols - hSpan) {
              alert(`このセルは右端のため、${hSpan}セル分の記号を配置できません`);
              return;
          }
          // クリア後に対象領域（メインセル＋右側継続セル）を設定
          for (let offset = 0; offset < hSpan; offset++) {
              this.grid[row][mainCol + offset] = this._createEmptyCell();
          }
          this.grid[row][mainCol] = { type: this.selectedStitch, color: this.selectedColor, multi: hSpan };
          for (let offset = 1; offset < hSpan; offset++) {
              this.grid[row][mainCol + offset] = { type: 'empty', color: 'transparent', isContinuation: true };
          }
          this.renderGrid();
          return;
      }
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
        const span = this.getRequiredCellSpan(this.grid[row][col].type);
        for (let offset = 0; offset < span; offset++) {
          if (col + offset < this.numCols && this.grid[row][col + offset].isContinuation) {
            this.grid[row][col + offset] = this._createEmptyCell();
          } else if (offset === 0) {
            this.grid[row][col] = this._createEmptyCell();
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
        const oldRows = this.numRows;
        
        // 行数の調整：増加の場合は上に追加、減少の場合は上から削除
        if (newRows > oldRows) {
          const diff = newRows - oldRows;
          const newRowsArr = [];
          for (let i = 0; i < diff; i++) {
            newRowsArr.push(this._createEmptyRow(newCols));
          }
          // 既存のグリッドの上部に新しい行を追加
          this.grid = newRowsArr.concat(this.grid);
        } else if (newRows < oldRows) {
          // gridの先頭から必要な行数だけを残す（上側が表示対象）
          this.grid = this.grid.slice(0, newRows);
        }
        
        // 各行の列数の調整
        for (let i = 0; i < newRows; i++) {
          // 行が存在しない場合は初期化
          if (!this.grid[i]) {
            this.grid[i] = [];
          }
          // 列を減らす場合は、行内の右側を削除
          if (this.grid[i].length > newCols) {
            this.grid[i] = this.grid[i].slice(0, newCols);
          }
          // 列を増やす場合は、右端に空セルを追加
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

    // それぞれの編み目が必要とする横方向セル数を返す
    getRequiredCellSpan(stitch) {
      // 2目一度系は横2セル使用
      if (
        stitch === 'right_up_two_one' ||
        stitch === 'left_up_two_one' ||
        stitch === 'purl_left_up_two_one' ||
        stitch === 'right_cross' ||
        stitch === 'left_cross' ||
        stitch === 'purl_right_cross' ||
        stitch === 'purl_left_cross' ||
        stitch === 'purl_right_up_two_cross' ||
        stitch === 'purl_left_up_two_cross'
      ) return 2;
      if (stitch === 'right_up_two_cross' || stitch === 'left_up_two_cross') return 4;
      // 新規3目交差は横6セル使用
      if (stitch === 'right_up_three_cross' || stitch === 'left_up_three_cross') return 6;
      const threeCellSymbols = ['middle_up_three_one', 'right_up_three_one', 'left_up_three_one'];
      if (threeCellSymbols.includes(stitch)) return 3;
      return 1;
    }

    // すべり目（slip_stitch）は縦に2セル分使用する
    getRequiredCellVerticalSpan(stitch) {
      if (stitch === 'slip_stitch') return 2;
      return 1;
    }

    getRowColor(row) {
      // 横方向の縞模様に基づいて背景色を設定する例
      // ここでは偶数行と奇数行で異なる固定のカラーを使用しています。
      return row % 2 === 0 ? '#e8e8e8' : '#ffffff';

    }
  }
