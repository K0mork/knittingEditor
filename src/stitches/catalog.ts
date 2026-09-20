import { getStitchSymbol } from './svgMarkup.js';

export const STITCH_CATALOG_VERSION = 1;
export type StitchCategory = 'basic' | 'decrease' | 'cable' | 'twist' | 'utility';

export interface StitchDefinition {
  id: number;
  key: string;
  name: string;
  width: number;
  height: number;
  category: StitchCategory;
  svg: string;
}

const definitions: Array<Omit<StitchDefinition, 'svg'>> = [
  // idは編み図とバックアップに保存される永続値。変更・再利用しないこと。
  { id: 1, key: 'knit', name: '表目', width: 1, height: 1, category: 'basic' },
  { id: 2, key: 'purl', name: '裏目', width: 1, height: 1, category: 'basic' },
  { id: 3, key: 'yo', name: 'かけ目', width: 1, height: 1, category: 'basic' },
  { id: 4, key: 'right_up_two_one', name: '右上2目一度', width: 2, height: 1, category: 'decrease' },
  { id: 5, key: 'left_up_two_one', name: '左上2目一度', width: 2, height: 1, category: 'decrease' },
  { id: 6, key: 'purl_left_up_two_one', name: '裏目の左上2目一度', width: 2, height: 1, category: 'decrease' },
  { id: 7, key: 'right_cross', name: '右上交差', width: 2, height: 1, category: 'cable' },
  { id: 8, key: 'left_cross', name: '左上交差', width: 2, height: 1, category: 'cable' },
  { id: 9, key: 'purl_right_cross', name: '裏目右上交差', width: 2, height: 1, category: 'cable' },
  { id: 10, key: 'purl_left_cross', name: '裏目左上交差', width: 2, height: 1, category: 'cable' },
  { id: 11, key: 'purl_right_up_two_cross', name: '裏目右上2×1交差', width: 3, height: 1, category: 'cable' },
  { id: 12, key: 'purl_left_up_two_cross', name: '裏目左上2×1交差', width: 3, height: 1, category: 'cable' },
  { id: 13, key: 'purl_right_cross_twist_stitch', name: '裏目右上ねじり目交差', width: 2, height: 1, category: 'cable' },
  { id: 14, key: 'purl_left_cross_twist_stitch', name: '裏目左上ねじり目交差', width: 2, height: 1, category: 'cable' },
  { id: 15, key: 'middle_up_three_one', name: '中上3目一度', width: 3, height: 1, category: 'decrease' },
  { id: 16, key: 'right_up_three_one', name: '右上3目一度', width: 3, height: 1, category: 'decrease' },
  { id: 17, key: 'left_up_three_one', name: '左上3目一度', width: 3, height: 1, category: 'decrease' },
  { id: 18, key: 'right_up_two_cross', name: '右上2目交差', width: 4, height: 1, category: 'cable' },
  { id: 19, key: 'left_up_two_cross', name: '左上2目交差', width: 4, height: 1, category: 'cable' },
  { id: 20, key: 'right_up_three_cross', name: '右上3目交差', width: 6, height: 1, category: 'cable' },
  { id: 21, key: 'left_up_three_cross', name: '左上3目交差', width: 6, height: 1, category: 'cable' },
  { id: 22, key: 'slip_stitch', name: 'すべり目', width: 1, height: 2, category: 'basic' },
  { id: 23, key: 'twist_stitch', name: 'ねじり目', width: 1, height: 1, category: 'twist' },
  { id: 24, key: 'purl_twist_stitch', name: 'ねじり裏目', width: 1, height: 1, category: 'twist' },
  { id: 25, key: 'erase', name: '白くする', width: 1, height: 1, category: 'utility' },
];

export const STITCH_CATEGORY_LABELS: Record<StitchCategory, string> = {
  basic: '基本', decrease: '減目', cable: '交差', twist: 'ねじり目', utility: '補助',
};

export const STITCHES: StitchDefinition[] = definitions.map((item) => ({ ...item, svg: getStitchSymbol(item.key) }));
export const STITCH_BY_ID = new Map(STITCHES.map((item) => [item.id, item]));
export const STITCH_BY_KEY = new Map(STITCHES.map((item) => [item.key, item]));
// 旧版localStorage内の綴り間違いを読み込むための互換名。
STITCH_BY_KEY.set('purl_twisst_stitch', STITCH_BY_ID.get(24)!);

export function stitchSvg(key: string): string {
  return STITCH_BY_KEY.get(key)?.svg ?? '';
}

export function svgDataUrl(key: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(stitchSvg(key))}`;
}
