import { loadGridState, saveGridState } from './storage.js';
import { GridManager } from './gridManager.js';
import { showNumberPrompt } from './prompt.js';
import { getStitchSymbol } from './stitchSymbols.js';


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
    { value: "twist_stitch", name: "ねじり目" },
    { value: "purl_twisst_stitch", name: "ねじり裏目" },
    { value: "erase", name: "白くする" }
  ];

  // カスタムドロップダウンの初期化
  const stitchDropdown = document.getElementById('stitch-type-dropdown');
  const selectedStitchDiv = document.getElementById('selected-stitch');
  const stitchOptionsDiv = document.getElementById('stitch-options');

  // 初期表示用：初期値は 'knit'（表目）とする
  const defaultOption = stitchOptions.find(opt => opt.value === 'knit');
  if (defaultOption) {
    const defaultIcon = getStitchSymbol(defaultOption.value);
    selectedStitchDiv.innerHTML = `<span class="dropdown-icon">${defaultIcon}</span><span class="dropdown-name">${defaultOption.name}</span>`;
  }

  // 各記号オプションを生成し追加
  stitchOptions.forEach(option => {
    const optionDiv = document.createElement('div');
    optionDiv.classList.add('custom-dropdown-option');
    optionDiv.dataset.stitch = option.value;
    const iconHTML = getStitchSymbol(option.value);
    optionDiv.innerHTML = `<span class="dropdown-icon">${iconHTML}</span><span class="dropdown-name">${option.name}</span>`;
    optionDiv.addEventListener('click', () => {
      gridManager.setSelectedStitch(option.value);
      selectedStitchDiv.innerHTML = `<span class="dropdown-icon">${iconHTML}</span><span class="dropdown-name">${option.name}</span>`;
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

  // ドロップダウン以外クリック時にオプションリストを閉じる処理
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

// 行間に行を追加する処理
// 表示されている行番号（下から上に大きくなる：最下部が1、最上部がnumRows）を入力してもらい
// 入力された番号の上に新しい行が挿入される（内部インデックス = numRows - 入力値）
document.getElementById('insert-row-between').addEventListener('click', () => {
  showNumberPrompt(
    "挿入したい行番号を入力してください。（1～" + gridManager.numRows + "）\n※入力された行番号の上に新しい行が挿入されます",
    1,
    gridManager.numRows,
    (enteredLabel) => {
      // 表示上は下から上（最下部が1、最上部が numRows）なので内部インデックスは numRows - 入力値
      const insertIndex = gridManager.numRows - enteredLabel;
      gridManager.insertRowAt(insertIndex);
    }
  );
});

// 列間に列を追加する処理
// 表示されている列番号は右から左に大きくなっており（最右が1、最左がnumCols）
// 入力された番号に対して、対象セルの左側に新たな列を挿入する
document.getElementById('insert-col-between').addEventListener('click', () => {
  showNumberPrompt(
    "挿入したい列番号を入力してください。（1～" + gridManager.numCols + "）\n※入力された列番号の左に新しい列が挿入されます",
    1,
    gridManager.numCols,
    (enteredLabel) => {
      // 表示上は右から左（最右が1、最左が numCols）なので対象の内部インデックスは numCols - 入力値
      const insertIndex = gridManager.numCols - enteredLabel;
      gridManager.insertColumnAt(insertIndex);
    }
  );
});

// 指定行削除ボタンのイベント設定
document.getElementById('remove-row-at').addEventListener('click', () => {
  showNumberPrompt(
    "削除したい行番号を入力してください。（1～" + gridManager.numRows + "）",
    1,
    gridManager.numRows,
    (enteredLabel) => {
      // 表示上は下から上（最下部が1、最上部が numRows）なので内部インデックスは numRows - 入力値
      const deleteIndex = gridManager.numRows - enteredLabel;
      gridManager.removeRowAt(deleteIndex);
    }
  );
});

// 指定列削除ボタンのイベント設定
document.getElementById('remove-col-at').addEventListener('click', () => {
  showNumberPrompt(
    "削除したい列番号を入力してください。（1～" + gridManager.numCols + "）",
    1,
    gridManager.numCols,
    (enteredLabel) => {
      // 表示上は右から左（最右が1、最左が numCols）なので内部インデックスは numCols - 入力値
      const deleteIndex = gridManager.numCols - enteredLabel;
      gridManager.removeColumnAt(deleteIndex);
    }
  );
});

  // 画像保存機能
  document.getElementById('download-chart').addEventListener('click', () => {
    html2canvas(document.querySelector("#grid-wrapper")).then(canvas => {
      // Edge(旧版)向けのフォールバック処理
      if (window.navigator.msSaveBlob) {
        canvas.toBlob(blob => {
          window.navigator.msSaveBlob(blob, 'knitting-chart.png');
        });
      } else {
        const link = document.createElement('a');
        link.download = 'knitting-chart.png';
        link.href = canvas.toDataURL();
        link.click();
      }
    });
  });
});