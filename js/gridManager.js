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
  
    // 指定の記号が横2マス分を使用するかどうか返すヘルパー
    isMultiCellStitch(stitch) {
      const multiStitchTypes = ['right_up_two_one', 'left_up_two_one', 'purl_left_up_two_one', 'right_up_two_cross', 'left_up_two_cross'];
      return multiStitchTypes.includes(stitch);
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

      // 継続セルの場合は表示せず、クリック不可にする
      if (cellData && cellData.isContinuation) {
        cell.style.visibility = 'hidden';
        cell.style.pointerEvents = 'none';
        return;
      } else {
        cell.style.visibility = 'visible';
      }

      let svgMarkup = this.getStitchSymbol(cellData.type);
      if (cellData && cellData.multi) {
        // 多セル記号のメインセルの場合、横は2マス分、縦は1マス
        symbolElem.innerHTML = svgMarkup;
        symbolElem.style.width = `calc(2 * var(--cell-size))`;
        symbolElem.style.height = '100%';
        // 絶対配置にしてセル内の左上に表示（セルは相対配置）
        symbolElem.style.position = 'absolute';
        symbolElem.style.left = '0';
        symbolElem.style.top = '0';
        cell.style.position = 'relative';
        // 右側の境界線を消して連結感を演出
        cell.style.borderRight = 'none';

        // SVG 要素に対してアスペクト比維持を無効化し、横に伸ばす
        const svgElem = symbolElem.querySelector('svg');
        if (svgElem) {
          svgElem.setAttribute('preserveAspectRatio', 'none');
        }
      } else {
        // 通常セルの場合はそのまま1セル分のサイズで表示
        symbolElem.innerHTML = svgMarkup;
        symbolElem.style.width = '100%';
        symbolElem.style.height = '100%';
        cell.style.borderRight = '';
        cell.style.position = '';
      }
      symbolElem.style.color = cellData.color || '#000000';
    }
  
    getStitchSymbol(type) {
      switch (type) {
        case 'knit':
          return `
          <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" fill="none" d="M 0,850.5 H 850.5 V 0 H 0 Z" />
            <path stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 425.62891,84.37109 V 766.4375" />
          </svg>
          `;
    
        case 'purl':
          return `
          <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 81.375 424.878906 L 770.230469 424.871094"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          </svg>
          `;
    
        case 'left_up_three_one':
          return `
          <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 398.621094 441.378906 L 735.601562 98.964844"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 398.621094 441.378906 L 398.628906 32.390625"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 115.871094 98.964844 L 398.460938 441.378906"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 712.359375 817.878906 L 115.871094 99.128906"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          </svg>
          `;
    
        case 'left_up_two_cross':
          return `
          <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 683.121094 794.628906 L 58.125 170.988281"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 426.058594 536.46875 L 170.621094 794.628906"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 793.371094 679.128906 L 168.371094 55.484375"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 793.558594 170.46875 L 538.128906 428.628906"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 682.558594 55.722656 L 427.128906 313.878906"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 313.460938 425.140625 L 59.625 676.128906"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          </svg>
          `;
    
        case 'left_up_two_one':
          return `
          <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 425.628906 424.878906 L 762.601562 82.464844"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 762.828125 767.628906 L 88.875 82.804688"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          </svg>
          `;
    
        case 'middle_up_three_one':
          return `
          <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 398.621094 424.878906 L 735.601562 82.464844"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 398.621094 767.628906 L 398.628906 82.804688"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 115.871094 82.464844 L 398.460938 424.878906"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          </svg>
          `;
    
        case 'purl_left_up_two_one':
          return `
          <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 425.628906 424.878906 L 762.601562 82.464844"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 762.828125 767.628906 L 88.875 82.804688"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 277.878906 138.378906 L 575.429688 138.371094"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          </svg>
          `;
    
        case 'right_up_three_one':
          return `
          <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 398.621094 479.628906 L 735.601562 137.21875"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 398.621094 479.628906 L 398.628906 84.226562"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 115.871094 137.21875 L 398.460938 479.628906"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 115.871094 765.378906 L 735.441406 137.160156"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          </svg>
          `;
    
        case 'right_up_two_cross':
          return `
          <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 170.628906 793.128906 L 792.910156 173.558594"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 55.125 680.628906 L 680.121094 56.984375"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 311.921875 423.378906 L 55.125 173.378906"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 680.171875 793.128906 L 423.371094 543.128906"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 795.671875 680.628906 L 538.878906 430.628906"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 422.171875 310.878906 L 165.371094 60.875"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          </svg>
          `;
    
        case 'right_up_two_one':
          return `
          <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 144.378906 767.628906 L 762.578125 82.804688"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 438.101562 438.378906 L 88.875 82.398438"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          </svg>
          `;
    
        case 'slip_stitch':
          return `
          <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 90.375 754.878906 L 425.949219 119.011719"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 761.199219 754.878906 L 425.621094 119.011719"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="currentColor" fill-opacity="1" stroke="none" stroke-width="1.5002" stroke-linecap="butt" stroke-linejoin="miter"
              d="M 381.75 95.25 L 468.75 95.25 L 468.75 212.25 L 381.75 212.25 Z"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          </svg>
          `;
    
        case 'twist_stitch':
          return `
          <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 595.550781 545.628906 L 599.628906 428.828125 C 598.039062 418.648438 593.960938 386.730469 590.109375 367.71875 C 586.25 348.710938 583.539062 332.410156 576.511719 314.761719 C 569.488281 297.101562 556.789062 276.730469 547.960938 261.789062 C 539.121094 246.859375 534.808594 236.898438 523.480469 225.128906 C 512.148438 213.359375 493.121094 199.550781 479.96875 191.179688 C 466.828125 182.800781 472.039062 184.390625 444.621094 174.878906 C 417.199219 165.371094 356.238281 144.101562 315.449219 134.140625 C 274.660156 124.179688 214.828125 116.710938 199.871094 115.121094" 
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 260.960938 538.878906 C 256.148438 517.769531 251.339844 496.671875 250.328125 476.96875 C 249.308594 457.28125 252.351562 440.398438 254.878906 420.699219 C 257.421875 401 261.21875 378.261719 265.519531 358.800781 C 269.828125 339.339844 272.109375 323.160156 280.71875 303.929688 C 289.339844 284.699219 306.050781 259.621094 317.199219 243.441406 C 328.351562 227.261719 337.460938 216.941406 347.601562 206.859375 C 357.730469 196.78125 362.539062 192.320312 378 182.941406 C 393.449219 173.558594 397.25 164.890625 440.308594 150.589844 C 483.371094 136.28125 601.160156 107.910156 636.378906 97.125" 
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
              stroke-opacity="1" stroke-miterlimit="10" d="M 259.871094 522.378906 C 263.039062 542.410156 266.210938 562.449219 272.089844 582.480469 C 277.96875 602.519531 285.660156 623.289062 295.160156 642.589844 C 304.671875 661.890625 320.050781 686.078125 329.101562 698.300781 C 338.148438 710.511719 343.800781 710.761719 349.460938 715.890625 C 355.109375 721.019531 357.371094 724.691406 363.03125 729.078125 C 368.679688 733.480469 376.148438 738.859375 383.390625 742.28125 C 390.628906 745.699219 399 747.898438 406.460938 749.609375 C 413.929688 751.320312 420.710938 753.03125 428.179688 752.539062 C 435.640625 752.050781 443.109375 748.878906 451.25 746.679688 C 459.398438 744.480469 469.800781 742.519531 477.039062 739.351562 C 484.28125 736.171875 489.03125 731.769531 494.691406 727.621094 C 500.339844 723.460938 505.769531 719.070312 510.96875 714.421875 C 516.179688 709.78125 522.058594 704.648438 525.898438 699.761719 C 529.75 694.878906 530.429688 690.96875 534.050781 685.101562 C 537.671875 679.238281 543.550781 670.691406 547.621094 664.578125 C 551.691406 658.46875 555.308594 655.050781 558.480469 648.449219 C 561.648438 641.859375 566.621094 625 566.621094 625 C 569.339844 617.179688 572.050781 609.601562 574.769531 601.539062 C 577.480469 593.480469 580.191406 585.410156 582.910156 576.621094 C 585.621094 567.820312 589.019531 557.070312 591.050781 548.761719 C 593.089844 540.460938 592.410156 537.28125 595.128906 526.769531" 
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          </svg>
          `;

          case 'purl_twisst_stitch':
            return `
            <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
              <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
                stroke-opacity="1" stroke-miterlimit="10" d="M 603.050781 587.628906 L 607.128906 470.828125 C 605.539062 460.648438 601.460938 428.730469 597.609375 409.71875 C 593.75 390.710938 591.039062 374.410156 584.011719 356.761719 C 576.988281 339.101562 564.289062 318.730469 555.460938 303.789062 C 546.621094 288.859375 542.308594 278.898438 530.980469 267.128906 C 519.648438 255.359375 500.621094 241.550781 487.46875 233.179688 C 474.328125 224.800781 479.539062 226.390625 452.121094 216.878906 C 424.699219 207.371094 363.738281 186.101562 322.949219 176.140625 C 282.160156 166.179688 222.328125 158.710938 207.371094 157.128906" transform="matrix(1, 0, 0, -1, 0, 850.5)" />
              <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
                stroke-opacity="1" stroke-miterlimit="10" d="M 268.460938 580.878906 C 263.648438 559.769531 258.839844 538.671875 257.820312 518.96875 C 256.808594 499.28125 259.851562 482.398438 262.378906 462.699219 C 264.921875 443 268.71875 420.261719 273.019531 400.800781 C 277.328125 381.339844 279.609375 365.160156 288.21875 345.929688 C 296.839844 326.699219 313.550781 301.621094 324.699219 285.441406 C 335.851562 269.261719 344.960938 258.941406 355.101562 248.859375 C 365.230469 238.78125 370.039062 234.320312 385.5 224.941406 C 400.949219 215.558594 404.75 206.890625 447.808594 192.589844 C 490.871094 178.28125 608.660156 149.910156 636.378906 139.128906" transform="matrix(1, 0, 0, -1, 0, 850.5)" />
              <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="butt" stroke-linejoin="miter"
                stroke-opacity="1" stroke-miterlimit="10" d="M 267.371094 565.128906 C 270.539062 585.101562 273.710938 605.070312 279.589844 625.039062 C 285.46875 645.011719 293.160156 665.710938 302.660156 684.949219 C 312.171875 704.191406 327.550781 728.300781 336.601562 740.46875 C 345.648438 752.648438 351.300781 752.898438 356.960938 758.011719 C 362.609375 763.121094 364.871094 766.78125 370.53125 771.160156 C 376.179688 775.539062 383.648438 780.898438 390.890625 784.308594 C 398.128906 787.71875 406.5 789.910156 413.960938 791.621094 C 421.429688 793.320312 428.210938 795.03125 435.679688 794.539062 C 443.140625 794.050781 450.609375 790.890625 458.75 788.699219 C 466.898438 786.5 477.300781 784.558594 484.539062 781.390625 C 491.78125 778.21875 496.53125 773.839844 502.191406 769.699219 C 507.839844 765.558594 513.269531 761.179688 518.46875 756.550781 C 523.679688 751.921875 529.558594 746.808594 533.398438 741.941406 C 537.25 737.058594 537.929688 733.171875 541.550781 727.320312 C 545.171875 721.480469 551.050781 712.949219 555.121094 706.871094 C 559.191406 700.78125 562.808594 697.371094 565.980469 690.789062 C 569.148438 684.21875 574.121094 667.410156 574.121094 667.410156 C 576.839844 659.621094 579.550781 652.070312 582.269531 644.03125 C 584.980469 636 587.691406 627.960938 590.410156 619.191406 C 593.121094 610.421875 596.519531 599.710938 598.550781 591.429688 C 600.589844 583.148438 599.910156 579.980469 602.628906 569.511719" transform="matrix(1, 0, 0, -1, 0, 850.5)" />
              <path fill="none" stroke="currentColor" stroke-width="80.012" stroke-linecap="butt" stroke-linejoin="miter"
                stroke-opacity="1" stroke-miterlimit="10" d="M 183.371094 44.625 L 667.179688 44.625" transform="matrix(1, 0, 0, -1, 0, 850.5)" />
            </svg>
            `;
    
        case 'yo':
          return `
          <svg viewBox="0 0 850.5 850.5" style="width:100%;height:100%;" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" fill="none" d="M 0 850.5 L 850.5 850.5 L 850.5 0 L 0 0 Z" />
            <path fill="none" stroke="currentColor" stroke-width="100.01" stroke-linecap="round" stroke-linejoin="round"
              stroke-opacity="1" stroke-miterlimit="10" d="M 88.125 424.878906 C 88.125 611.269531 239.230469 762.378906 425.621094 762.378906 C 612.019531 762.378906 763.121094 611.269531 763.121094 424.878906 C 763.121094 238.480469 612.019531 87.375 425.621094 87.375 C 239.230469 87.375 88.125 238.480469 88.125 424.878906 Z"
              transform="matrix(1, 0, 0, -1, 0, 850.5)" />
          </svg>
          `;
    
        default:
          return '';
      }
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
      const cell = e.currentTarget;
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);

      if (this.isMultiCellStitch(this.selectedStitch)) {
        if (col >= this.numCols - 1) {
          alert("このセルは右端のため、2セル分の記号を配置できません");
          return;
        }
        // 既に多セル記号が配置されていれば削除
        if (this.grid[row][col].type === this.selectedStitch && this.grid[row][col].multi) {
          this.grid[row][col] = { type: 'empty', color: '#ffffff' };
          if (this.grid[row][col+1] && this.grid[row][col+1].isContinuation) {
            this.grid[row][col+1] = { type: 'empty', color: '#ffffff' };
          }
        } else {
          // 右隣がすでに使用中の場合は配置できない
          if (this.grid[row][col+1].type !== 'empty' || this.grid[row][col+1].isContinuation) {
            alert("右隣のセルが使用中です");
            return;
          }
          this.grid[row][col] = { type: this.selectedStitch, color: this.selectedColor, multi: true };
          this.grid[row][col+1] = { type: 'empty', color: '#ffffff', isContinuation: true };
        }
      } else {
        if (this.grid[row][col].type === this.selectedStitch) {
          this.grid[row][col] = { type: 'empty', color: '#ffffff' };
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
        if (col > 0 && this.isMultiCellStitch(this.grid[row][col-1].type)) {
          this.grid[row][col-1] = { type: 'empty', color: '#ffffff' };
          this.grid[row][col] = { type: 'empty', color: '#ffffff' };
        }
      } else if (this.isMultiCellStitch(this.grid[row][col].type) && this.grid[row][col].multi) {
        // メインセルの場合は右隣の継続セルもクリア
        this.grid[row][col] = { type: 'empty', color: '#ffffff' };
        if (col < this.numCols - 1 && this.grid[row][col+1].isContinuation) {
          this.grid[row][col+1] = { type: 'empty', color: '#ffffff' };
        }
      } else {
        this.grid[row][col] = { type: 'empty', color: '#ffffff' };
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

      if (this.isMultiCellStitch(this.selectedStitch)) {
        if (col >= this.numCols - 1) return;
        if (!(this.grid[row][col].type === this.selectedStitch && this.grid[row][col].multi)) {
          if (this.grid[row][col+1].type !== 'empty' || this.grid[row][col+1].isContinuation) {
            return;
          }
          this.grid[row][col] = { type: this.selectedStitch, color: this.selectedColor, multi: true };
          this.grid[row][col+1] = { type: 'empty', color: '#ffffff', isContinuation: true };
          this.renderGrid();
        }
      } else {
        if (this.grid[row][col].type !== this.selectedStitch) {
          this.grid[row][col] = { type: this.selectedStitch, color: this.selectedColor };
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

    // 指定した位置に新しい行を挿入する
    insertRowAt(index) {
      const newRow = [];
      for (let j = 0; j < this.numCols; j++) {
        newRow.push({ type: 'empty', color: '#ffffff' });
      }
      this.grid.splice(index, 0, newRow);
      this.numRows++;
      this.renderGrid();
    }

    // 指定した位置に新しい列を挿入する
    insertColumnAt(index) {
      for (let i = 0; i < this.numRows; i++) {
        this.grid[i].splice(index, 0, { type: 'empty', color: '#ffffff' });
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
  }