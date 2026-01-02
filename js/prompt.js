export function showNumberPrompt(message, min, max, callback) {
  const modal = document.getElementById('number-prompt-modal');
  const messageElem = modal.querySelector('.number-prompt-message');
  const inputElem = modal.querySelector('#number-prompt-input');
  const okBtn = modal.querySelector('#number-prompt-ok');
  const cancelBtn = modal.querySelector('#number-prompt-cancel');
  const contentElem = modal.querySelector('.number-prompt-content');

  messageElem.textContent = message;
  inputElem.value = '';
  inputElem.min = min;
  inputElem.max = max;
  modal.style.display = 'flex';
  inputElem.focus();

  function cleanup() {
    modal.style.display = 'none';
    cancelBtn.removeEventListener('click', onCancel);
    okBtn.removeEventListener('click', onOk);
    modal.removeEventListener('click', onBackdropClick);
    document.removeEventListener('keydown', onKeydown);
  }

  function onOk() {
    const value = parseInt(inputElem.value, 10);
    if (isNaN(value)) {
      alert('有効な数字を入力してください');
      return;
    }
    cleanup();
    callback(value);
  }

  function onCancel() {
    cleanup();
  }

  function onBackdropClick(e) {
    if (e.target === modal) {
      cleanup();
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      cleanup();
    } else if (e.key === 'Enter') {
      onOk();
    }
  }

  okBtn.addEventListener('click', onOk);
  cancelBtn.addEventListener('click', onCancel);
  modal.addEventListener('click', onBackdropClick);
  document.addEventListener('keydown', onKeydown);
}
