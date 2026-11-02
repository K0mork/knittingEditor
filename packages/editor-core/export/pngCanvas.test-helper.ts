import { minimumPngBytes } from './exporters';

/** 寸法だけを持つPNG。`renderPng`はIHDRの寸法を描画面と比べ、寸法に見合う大きさかも確かめるので、その分を0で埋める。 */
export function pngHeader(width: number, height: number): Blob {
  const view = new DataView(new ArrayBuffer(Math.max(24, minimumPngBytes(width, height))));
  view.setUint32(0, 0x89504e47);
  view.setUint32(4, 0x0d0a1a0a);
  view.setUint32(8, 13);
  view.setUint32(12, 0x49484452);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new Blob([view.buffer], { type: 'image/png' });
}

/** 確保できた描画面の左上を読んだ結果（白い紙）。 */
export const whitePixel = () => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) });
