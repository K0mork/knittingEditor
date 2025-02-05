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