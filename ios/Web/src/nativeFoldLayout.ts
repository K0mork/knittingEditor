/** CSSだけでは実際の矩形と帯の交差を判定できないため、元の配置を測って補正する。 */
export function observeFoldOverlays(): { update: () => void; stop: () => void } {
  const root = document.documentElement;
  const selector = '.drawer, .toast, .busy, .selection-actions';
  const properties = ['--fold-shift-x', '--fold-shift-y', '--fold-max-width', '--fold-max-height'];
  let frame = 0;
  const reset = (element: HTMLElement) => {
    element.removeAttribute('data-fold-adjusted');
    for (const property of properties) element.style.removeProperty(property);
  };
  const observed = new Set<HTMLElement>();
  const resize = new ResizeObserver(() => schedule());
  const update = () => {
    frame = 0;
    const elements = [...document.querySelectorAll<HTMLElement>(selector)];
    for (const element of elements) reset(element);
    const axis = root.dataset.fold;
    const start = parseFloat(root.style.getPropertyValue('--fold-start'));
    const end = parseFloat(root.style.getPropertyValue('--fold-end'));
    if ((axis === 'vertical' || axis === 'horizontal') && Number.isFinite(start) && end > start) {
      for (const element of elements) {
        let box = element.getBoundingClientRect();
        if (!box.width || !box.height) continue;
        const vertical = axis === 'vertical';
        if (vertical ? box.right <= start || box.left >= end : box.bottom <= start || box.top >= end) continue;
        element.setAttribute('data-fold-adjusted', '');
        element.style.setProperty('--fold-max-width', `${box.width}px`);
        element.style.setProperty('--fold-max-height', `${box.height}px`);
        // 元の最大寸法を拡大しない。右アンカーや中央揃えは元のCSSに任せる。
        if (vertical) {
          element.style.setProperty('--fold-max-width', `${Math.min(box.width, Math.max(0, innerWidth - end - 24))}px`);
        } else {
          element.style.setProperty('--fold-max-height', `${Math.min(box.height, Math.max(0, start - 16))}px`);
        }
        box = element.getBoundingClientRect();
        element.style.setProperty('--fold-shift-x', `${vertical ? Math.max(0, end + 12 - box.left) : 0}px`);
        element.style.setProperty('--fold-shift-y', `${vertical ? 0 : Math.min(0, start - 8 - box.bottom)}px`);
      }
    }
    for (const element of observed) {
      if (!elements.includes(element)) { reset(element); resize.unobserve(element); observed.delete(element); }
    }
    for (const element of elements) {
      if (!observed.has(element)) { resize.observe(element); observed.add(element); }
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const mutations = new MutationObserver(schedule);
  mutations.observe(root, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  schedule();
  return {
    update: schedule,
    stop: () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resize.disconnect();
      window.removeEventListener('resize', schedule);
      for (const element of observed) reset(element);
      observed.clear();
    },
  };
}
