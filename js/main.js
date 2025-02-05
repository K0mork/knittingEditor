import { loadGridState, saveGridState } from './storage.js';
import { GridManager } from './gridManager.js';

document.addEventListener('DOMContentLoaded', () => {
  // ローカルストレージからグリッド状態を読み込む
  const savedState = loadGridState();
  const gridOptions = savedState ? {
    numRows: savedState.numRows,
    numCols: savedState.numCols,
    grid: savedState.grid,
    selectedColor: '#ff0000',
    selectedStitch: 'knit',
    onStateChange: (state) => saveGridState(state)
  } : {
    onStateChange: (state) => saveGridState(state)
  };

  // GridManager のインスタンスを生成しグリッドを初期化
  const gridManager = new GridManager(gridOptions);

  // カラーピッカーのイベント設定
  document.getElementById('color-picker').addEventListener('input', (e) => {
    gridManager.setSelectedColor(e.target.value);
  });

  // カスタムドロップダウン用の記号オプションデータ
  const stitchOptions = [
    { value: "knit", name: "表目" },
    { value: "purl", name: "裏目" },
    { value: "yo", name: "かけ目" },
    { value: "right_up_two_one", name: "右上2目一度" },
    { value: "left_up_two_one", name: "左上2目一度" },
    { value: "purl_left_up_two_one", name: "裏目の左上2目一度" },
    { value: "middle_up_three_one", name: "中上3目一度" },
    { value: "right_up_three_one", name: "右上3目一度" },
    { value: "left_up_three_one", name: "左上3目一度" },
    { value: "right_up_two_cross", name: "右上2目交差" },
    { value: "left_up_two_cross", name: "左上2目交差" },
    { value: "slip_stitch", name: "すべり目" },
    { value: "twist_stitch", name: "ねじり目" }
  ];

  // カスタムドロップダウンの初期化
  const stitchDropdown = document.getElementById('stitch-type-dropdown');
  const selectedStitchDiv = document.getElementById('selected-stitch');
  const stitchOptionsDiv = document.getElementById('stitch-options');

  // 初期表示用：初期値は 'knit'（表目）とする
  const defaultOption = stitchOptions.find(opt => opt.value === 'knit');
  if (defaultOption) {
    const defaultIcon = gridManager.getStitchSymbol(defaultOption.value);
    selectedStitchDiv.innerHTML = `<span class="dropdown-icon">${defaultIcon}</span><span class="dropdown-name">${defaultOption.name}</span>`;
  }

  // 各記号オプションを生成し追加
  stitchOptions.forEach(option => {
    const optionDiv = document.createElement('div');
    optionDiv.classList.add('custom-dropdown-option');
    optionDiv.dataset.stitch = option.value;
    // gridManager の getStitchSymbol を利用してSVGアイコンを取得
    const iconHTML = gridManager.getStitchSymbol(option.value);
    optionDiv.innerHTML = `<span class="dropdown-icon">${iconHTML}</span><span class="dropdown-name">${option.name}</span>`;
    optionDiv.addEventListener('click', () => {
      // gridManager の選択記号を更新
      gridManager.setSelectedStitch(option.value);
      // ヘッダ部分の表示を更新
      selectedStitchDiv.innerHTML = `<span class="dropdown-icon">${iconHTML}</span><span class="dropdown-name">${option.name}</span>`;
      // オプションを非表示にする
      stitchOptionsDiv.style.display = 'none';
    });
    stitchOptionsDiv.appendChild(optionDiv);
  });

  // ヘッダ部分をクリックでオプション表示／非表示を切り替え
  selectedStitchDiv.addEventListener('click', () => {
    if (stitchOptionsDiv.style.display === 'none' || stitchOptionsDiv.style.display === '') {
      stitchOptionsDiv.style.display = 'block';
    } else {
      stitchOptionsDiv.style.display = 'none';
    }
  });

  // ドロップダウン以外をクリックしたときにオプションリストを閉じる処理
  document.addEventListener('click', (event) => {
    if (!stitchDropdown.contains(event.target)) {
      stitchOptionsDiv.style.display = 'none';
    }
  });

  // ツールバーその他のイベント設定
  document.getElementById('update-grid-size').addEventListener('click', () => {
    const newRows = parseInt(document.getElementById('grid-rows-input').value);
    const newCols = parseInt(document.getElementById('grid-cols-input').value);
    gridManager.updateGridSize(newRows, newCols);
  });
  document.getElementById('add-row-top').addEventListener('click', () => gridManager.addRowTop());
  document.getElementById('add-row-bottom').addEventListener('click', () => gridManager.addRowBottom());
  document.getElementById('add-col-left').addEventListener('click', () => gridManager.addColumnLeft());
  document.getElementById('add-col-right').addEventListener('click', () => gridManager.addColumnRight());
  document.getElementById('remove-row-top').addEventListener('click', () => gridManager.removeRowTop());
  document.getElementById('remove-row-bottom').addEventListener('click', () => gridManager.removeRowBottom());
  document.getElementById('remove-col-left').addEventListener('click', () => gridManager.removeColumnLeft());
  document.getElementById('remove-col-right').addEventListener('click', () => gridManager.removeColumnRight());
  document.getElementById('clear-grid').addEventListener('click', () => gridManager.clearGrid());

  // 画像保存機能
  document.getElementById('download-chart').addEventListener('click', () => {
    html2canvas(document.querySelector("#grid-wrapper")).then(canvas => {
      const link = document.createElement('a');
      link.download = 'knitting-chart.png';
      link.href = canvas.toDataURL();
      link.click();
    });
  });
});