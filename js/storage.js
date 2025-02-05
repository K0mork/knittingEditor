export function loadGridState() {
    const saved = localStorage.getItem('knittingChartData');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data && data.numRows && data.numCols && data.grid) {
                return data;
            }
        } catch (e) {
            console.error("保存されたデータの読み込みに失敗しました", e);
        }
    }
    return null;
}

export function saveGridState(data) {
    localStorage.setItem('knittingChartData', JSON.stringify(data));
}