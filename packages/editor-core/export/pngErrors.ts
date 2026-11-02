/**
 * 端末のメモリが足りず、PNGの描画面を確保できなかったとき。
 *
 * iOSのWebKitは、上限内の大きさでもメモリの少ない端末では描画面の確保に失敗することがあり、
 * そのときは例外を出さずに空の小さな画像を返す（iPhone 13 miniで1000×1000・1セル7pxが163 bytesになった）。
 */
export class PngCanvasError extends Error {
  constructor() {
    super('端末のメモリが足りず、PNGを作れませんでした。1セルの画素数を下げるか、PDF保存を利用してください。');
  }
}
