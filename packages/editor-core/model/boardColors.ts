import { colorHex, parseColor } from './Board';

/**
 * 盤面の地（背景色）と、地から作る縞・罫線の色。ReactにもDOMにも依存しない。
 *
 * 地の色は編み図ごとに利用者が選ぶ（#140）。記号は利用者が選んだ色のまま描き、地に近い色の
 * 記号が見えにくいときは、利用者が地の色を変えて見分ける。記号の形や色は地の色によって変えない。
 */

/** 地の色を選んでいない編み図の地。背景色を加える前と同じ見た目になる。 */
export const DEFAULT_BACKGROUND_COLOR = '#ffffff';

export const BACKGROUND_PRESETS: ReadonlyArray<{ label: string; color: string }> = [
  { label: '白', color: '#ffffff' },
  { label: 'グレー', color: '#808080' },
  { label: '黒', color: '#1e1e1e' },
];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** `#rrggbb`なら小文字にして返す。それ以外（未設定・壊れた値）は`undefined`。 */
export function normalizeBackgroundColor(value: unknown): string | undefined {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : undefined;
}

/** 編み図の地の色。未設定や壊れた値は既定の白として読む。 */
export function backgroundColorOf(document: { backgroundColor?: string }): string {
  return normalizeBackgroundColor(document.backgroundColor) ?? DEFAULT_BACKGROUND_COLOR;
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAGの相対輝度（0〜1）。 */
export function relativeLuminance(color: number): number {
  return 0.2126 * channelLuminance((color >>> 16) & 0xff)
    + 0.7152 * channelLuminance((color >>> 8) & 0xff)
    + 0.0722 * channelLuminance(color & 0xff);
}

/** 白より黒との差が小さい地。罫線と縞を地より明るい色で描く。 */
export function isDarkColor(color: number): boolean {
  const luminance = relativeLuminance(color);
  // 白とのコントラスト比 (1.05)/(L+0.05) と、黒とのコントラスト比 (L+0.05)/0.05 を比べる。
  return 1.05 / (luminance + 0.05) > (luminance + 0.05) / 0.05;
}

/** `from`を`to`へ`amount`（0〜1）だけ寄せた色。 */
export function mixColor(from: number, to: number, amount: number): number {
  const channel = (shift: number) => {
    const a = (from >>> shift) & 0xff;
    const b = (to >>> shift) & 0xff;
    return Math.round(a + (b - a) * amount);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export interface BoardSurface {
  /** 奇数段（下から数えて偶数段）の地。選んだ地の色そのもの。 */
  background: string;
  /** 1段おきに重ねる縞。地をわずかに罫線の色へ寄せる。 */
  stripe: string;
  /** 通常の罫線と、10目・10段ごとの太線。 */
  minorLine: string;
  majorLine: string;
}

/** 明るい地の縞と画面の罫線に使う、緑がかった濃い灰色。白い地では従来の色とほぼ同じになる。 */
const SCREEN_INK = 0x1e3328;
const PRINT_INK = 0x000000;
const LIGHT_INK = 0xffffff;
const STRIPE_AMOUNT = 0.054;

export type SurfaceKind = 'screen' | 'png' | 'pdf';

/**
 * 罫線を地からどれだけ寄せるか。白い地で、画面は従来の`#c9cec7`・`#7d8a83`、PNGは`#bbbbbb`・
 * `#666666`、PDFは0.78・0.4の灰色に合う割合にしてある。
 */
const LINE_AMOUNTS: Record<SurfaceKind, { minor: number; major: number }> = {
  screen: { minor: 0.24, major: 0.58 },
  png: { minor: 0.267, major: 0.6 },
  pdf: { minor: 0.22, major: 0.6 },
};

/** 地の色から縞と罫線の色を作る。明るい地では地を暗い色へ、暗い地では白へ寄せる。 */
export function boardSurface(background: string, kind: SurfaceKind): BoardSurface {
  const base = parseColor(background);
  const dark = isDarkColor(base);
  const lineInk = dark ? LIGHT_INK : kind === 'screen' ? SCREEN_INK : PRINT_INK;
  const { minor, major } = LINE_AMOUNTS[kind];
  return {
    background: colorHex(base),
    stripe: colorHex(mixColor(base, dark ? LIGHT_INK : SCREEN_INK, STRIPE_AMOUNT)),
    minorLine: colorHex(mixColor(base, lineInk, minor)),
    majorLine: colorHex(mixColor(base, lineInk, major)),
  };
}
