import { loadGridState, saveGridState } from './storage.js';
import { GridManager } from './gridManager.js';
import { showNumberPrompt } from './prompt.js';
import { getStitchSymbol } from './stitchSymbols.js';

const STITCH_OPTIONS = [
  { value: 'knit', name: '表目' },
  { value: 'purl', name: '裏目' },
  { value: 'yo', name: 'かけ目' },
  { value: 'right_up_two_one', name: '右上2目一度' },
  { value: 'left_up_two_one', name: '左上2目一度' },
  { value: 'purl_left_up_two_one', name: '裏目の左上2目一度' },
  { value: 'right_cross', name: '右上交差' },
  { value: 'left_cross', name: '左上交差' },
  { value: 'purl_right_cross', name: '裏目右上交差' },
  { value: 'purl_left_cross', name: '裏目左上交差' },
  { value: 'purl_right_up_two_cross', name: '裏目右上2×1交差' },
  { value: 'purl_left_up_two_cross', name: '裏目左上2×1交差' },
  { value: 'purl_right_cross_twist_stitch', name: '裏目右上ねじり目交差' },
  { value: 'purl_left_cross_twist_stitch', name: '裏目左上ねじり目交差' },
  { value: 'middle_up_three_one', name: '中上3目一度' },
  { value: 'right_up_three_one', name: '右上3目一度' },
  { value: 'left_up_three_one', name: '左上3目一度' },
  { value: 'right_up_two_cross', name: '右上2目交差' },
  { value: 'left_up_two_cross', name: '左上2目交差' },
  { value: 'right_up_three_cross', name: '右上3目交差' },
  { value: 'left_up_three_cross', name: '左上3目交差' },
  { value: 'slip_stitch', name: 'すべり目' },
  { value: 'twist_stitch', name: 'ねじり目' },
  { value: 'purl_twisst_stitch', name: 'ねじり裏目' },
  { value: 'erase', name: '白くする' }
];

// 簡易デバウンス（保存頻度を抑える）
const debounce = (fn, wait = 200) => {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};
const saveGridStateDebounced = debounce(saveGridState, 200);

const getDropdownElements = () => ({
  dropdown: document.getElementById('stitch-type-dropdown'),
  selected: document.getElementById('selected-stitch'),
  options: document.getElementById('stitch-options'),
});

const renderSelectedStitch = (target, option) => {
  const icon = getStitchSymbol(option.value);
  target.innerHTML = `<span class="dropdown-icon">${icon}</span><span class="dropdown-name">${option.name}</span>`;
};

const createGridManager = () => {
  const savedState = loadGridState();
  const baseOptions = { onStateChange: (state) => saveGridStateDebounced(state) };

  if (!savedState) return new GridManager(baseOptions);

  return new GridManager({
    ...baseOptions,
    numRows: savedState.numRows,
    numCols: savedState.numCols,
    grid: savedState.grid,
    selectedColor: '#ff0000',
    selectedStitch: 'knit',
  });
};

const setUpColorPicker = (gridManager) => {
  document.getElementById('color-picker').addEventListener('input', (e) => {
    gridManager.setSelectedColor(e.target.value);
  });
};

const buildDropdownOptions = (gridManager, dropdownEls) => {
  const fragment = document.createDocumentFragment();
  STITCH_OPTIONS.forEach((option) => {
    const optionDiv = document.createElement('div');
    optionDiv.classList.add('custom-dropdown-option');
    optionDiv.dataset.stitch = option.value;
    optionDiv.innerHTML = `<span class="dropdown-icon">${getStitchSymbol(option.value)}</span><span class="dropdown-name">${option.name}</span>`;
    optionDiv.addEventListener('click', () => {
      gridManager.setSelectedStitch(option.value);
      renderSelectedStitch(dropdownEls.selected, option);
      dropdownEls.options.style.display = 'none';
    });
    fragment.appendChild(optionDiv);
  });
  dropdownEls.options.appendChild(fragment);
};

const setUpDropdown = (gridManager) => {
  const dropdownEls = getDropdownElements();
  const defaultOption = STITCH_OPTIONS.find((opt) => opt.value === 'knit');
  if (defaultOption) renderSelectedStitch(dropdownEls.selected, defaultOption);

  buildDropdownOptions(gridManager, dropdownEls);

  dropdownEls.selected.addEventListener('click', () => {
    const isHidden = dropdownEls.options.style.display === 'none' || dropdownEls.options.style.display === '';
    dropdownEls.options.style.display = isHidden ? 'block' : 'none';
  });

  document.addEventListener('click', (event) => {
    if (!dropdownEls.dropdown.contains(event.target)) {
      dropdownEls.options.style.display = 'none';
    }
  });
};

const withNumberPrompt = (message, min, max, handler) => {
  showNumberPrompt(message, min, max, handler);
};

const setUpGridControls = (gridManager) => {
  const rowsInput = document.getElementById('grid-rows-input');
  const colsInput = document.getElementById('grid-cols-input');

  document.getElementById('update-grid-size').addEventListener('click', () => {
    gridManager.updateGridSize(parseInt(rowsInput.value, 10), parseInt(colsInput.value, 10));
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

  document.getElementById('insert-row-between').addEventListener('click', () => {
    withNumberPrompt(
      `挿入したい行番号を入力してください。（1～${gridManager.numRows}）\n※入力された行番号の上に新しい行が挿入されます`,
      1,
      gridManager.numRows,
      (label) => gridManager.insertRowAt(gridManager.numRows - label),
    );
  });

  document.getElementById('insert-col-between').addEventListener('click', () => {
    withNumberPrompt(
      `挿入したい列番号を入力してください。（1～${gridManager.numCols}）\n※入力された列番号の左に新しい列が挿入されます`,
      1,
      gridManager.numCols,
      (label) => gridManager.insertColumnAt(gridManager.numCols - label),
    );
  });

  document.getElementById('remove-row-at').addEventListener('click', () => {
    withNumberPrompt(
      `削除したい行番号を入力してください。（1～${gridManager.numRows}）`,
      1,
      gridManager.numRows,
      (label) => gridManager.removeRowAt(gridManager.numRows - label),
    );
  });

  document.getElementById('remove-col-at').addEventListener('click', () => {
    withNumberPrompt(
      `削除したい列番号を入力してください。（1～${gridManager.numCols}）`,
      1,
      gridManager.numCols,
      (label) => gridManager.removeColumnAt(gridManager.numCols - label),
    );
  });
};

const setUpDownload = () => {
  document.getElementById('download-chart').addEventListener('click', () => {
    html2canvas(document.querySelector('#grid-wrapper')).then((canvas) => {
      if (window.navigator.msSaveBlob) {
        canvas.toBlob((blob) => window.navigator.msSaveBlob(blob, 'knitting-chart.png'));
        return;
      }
      const link = document.createElement('a');
      link.download = 'knitting-chart.png';
      link.href = canvas.toDataURL();
      link.click();
    });
  });
};

document.addEventListener('DOMContentLoaded', () => {
  const gridManager = createGridManager();
  setUpColorPicker(gridManager);
  setUpDropdown(gridManager);
  setUpGridControls(gridManager);
  setUpDownload();
});
