const databaseName = "knittingEditorAppM0";
const databaseVersion = 1;
const stateKey = "saveCount";

const capabilities = document.querySelector("#capabilities");
const saveCountLabel = document.querySelector("#save-count");
const saveButton = document.querySelector("#save-button");
const saveStatus = document.querySelector("#save-status");
const canvas = document.querySelector("#pointer-canvas");

function addCapability(label, passed) {
  const item = document.createElement("li");
  item.textContent = `${passed ? "✓" : "✗"} ${label}`;
  item.className = passed ? "passed" : "failed";
  capabilities.append(item);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("state");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

async function readSaveCount() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("state", "readonly");
    const request = transaction.objectStore("state").get(stateKey);
    request.onsuccess = () => resolve(request.result ?? 0);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
  });
}

async function writeSaveCount(value) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("state", "readwrite");
    transaction.objectStore("state").put(value, stateKey);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB write failed"));
  });
}

async function refreshSaveCount() {
  const count = await readSaveCount();
  saveCountLabel.textContent = String(count);
}

function startWorkerProbe() {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./worker.js", { type: "module" });
    worker.onmessage = (event) => {
      worker.terminate();
      resolve(event.data === "worker-ok");
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("module worker failed"));
    };
    worker.postMessage("probe");
  });
}

function enablePointerCanvas() {
  const context = canvas.getContext("2d");
  if (!context) return false;
  context.fillStyle = "#e8e2d5";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#3c2f2f";
  context.font = "16px sans-serif";
  context.fillText("Canvasをタップまたはドラッグ", 16, 28);
  canvas.addEventListener("pointerdown", (event) => {
    context.fillStyle = "#c76b5a";
    context.beginPath();
    context.arc(event.offsetX, event.offsetY, 8, 0, Math.PI * 2);
    context.fill();
  });
  return true;
}

async function runProbes() {
  addCapability("Canvas", enablePointerCanvas());
  addCapability("Pointer Events", "PointerEvent" in window);
  addCapability("IndexedDB", "indexedDB" in window);
  addCapability("Blob", "Blob" in window);
  try {
    addCapability("module Worker", await startWorkerProbe());
  } catch {
    addCapability("module Worker", false);
  }
  try {
    await refreshSaveCount();
    addCapability("IndexedDB read/write", true);
  } catch {
    addCapability("IndexedDB read/write", false);
    saveCountLabel.textContent = "利用不可";
  }
}

saveButton.addEventListener("click", async () => {
  saveButton.disabled = true;
  try {
    const nextCount = (await readSaveCount()) + 1;
    await writeSaveCount(nextCount);
    saveCountLabel.textContent = String(nextCount);
    saveStatus.textContent = "保存しました";
  } catch {
    saveStatus.textContent = "保存に失敗しました";
  } finally {
    saveButton.disabled = false;
  }
});

window.addEventListener("knittingEditorAppWillResignActive", () => {
  saveStatus.textContent = "バックグラウンド移行前の保存要求を受信しました";
});

runProbes();
