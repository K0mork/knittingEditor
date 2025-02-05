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

  // ツールバーのイベント設定
  document.getElementById('color-picker').addEventListener('input', (e) => {
    gridManager.setSelectedColor(e.target.value);
  });
  document.getElementById('stitch-type').addEventListener('change', (e) => {
    gridManager.setSelectedStitch(e.target.value);
  });
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