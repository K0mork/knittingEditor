import { encode } from 'uqr';

/** 出力に入れるサイト名とURL。 */
export const CREDIT_NAME = '棒針編み図エディタ';
export const CREDIT_URL = 'https://knittingeditor.com/';

/** QRの余白（モジュール数）。ISO/IEC 18004が定める4モジュールを取る。 */
const QR_BORDER = 4;

export interface CreditQr {
  /** 一辺のモジュール数（余白を含む）。 */
  size: number;
  /** 行ごとのモジュール。`true`が黒。 */
  modules: boolean[][];
}

/**
 * クレジットのQRコード。端末内で作り、URLを外部の生成サービスへ送らない。
 * 読み取りやすさを優先して誤り訂正はL（7%）にし、規格どおり余白を4モジュール取る。
 */
export function creditQr(): CreditQr {
  const { size, data } = encode(CREDIT_URL, { border: QR_BORDER, ecc: 'L' });
  return { size, modules: data };
}
