import { getStitchSymbol } from './svgMarkup.js';

export interface StitchDefinition {
  id: number;
  key: string;
  name: string;
  width: number;
  height: number;
}

const definitions: Omit<StitchDefinition, 'id'>[] = [
  { key: 'knit', name: '表目', width: 1, height: 1 },
  { key: 'purl', name: '裏目', width: 1, height: 1 },
  { key: 'yo', name: 'かけ目', width: 1, height: 1 },
  { key: 'right_up_two_one', name: '右上2目一度', width: 2, height: 1 },
  { key: 'left_up_two_one', name: '左上2目一度', width: 2, height: 1 },
  { key: 'purl_left_up_two_one', name: '裏目の左上2目一度', width: 2, height: 1 },
  { key: 'right_cross', name: '右上交差', width: 2, height: 1 },
  { key: 'left_cross', name: '左上交差', width: 2, height: 1 },
  { key: 'purl_right_cross', name: '裏目右上交差', width: 2, height: 1 },
  { key: 'purl_left_cross', name: '裏目左上交差', width: 2, height: 1 },
  { key: 'purl_right_up_two_cross', name: '裏目右上2×1交差', width: 3, height: 1 },
  { key: 'purl_left_up_two_cross', name: '裏目左上2×1交差', width: 3, height: 1 },
  { key: 'purl_right_cross_twist_stitch', name: '裏目右上ねじり目交差', width: 2, height: 1 },
  { key: 'purl_left_cross_twist_stitch', name: '裏目左上ねじり目交差', width: 2, height: 1 },
  { key: 'middle_up_three_one', name: '中上3目一度', width: 3, height: 1 },
  { key: 'right_up_three_one', name: '右上3目一度', width: 3, height: 1 },
  { key: 'left_up_three_one', name: '左上3目一度', width: 3, height: 1 },
  { key: 'right_up_two_cross', name: '右上2目交差', width: 4, height: 1 },
  { key: 'left_up_two_cross', name: '左上2目交差', width: 4, height: 1 },
  { key: 'right_up_three_cross', name: '右上3目交差', width: 6, height: 1 },
  { key: 'left_up_three_cross', name: '左上3目交差', width: 6, height: 1 },
  { key: 'slip_stitch', name: 'すべり目', width: 1, height: 2 },
  { key: 'twist_stitch', name: 'ねじり目', width: 1, height: 1 },
  { key: 'purl_twisst_stitch', name: 'ねじり裏目', width: 1, height: 1 },
  { key: 'erase', name: '白くする', width: 1, height: 1 },
];

export const STITCHES: StitchDefinition[] = definitions.map((item, index) => ({ ...item, id: index + 1 }));
export const STITCH_BY_ID = new Map(STITCHES.map((item) => [item.id, item]));
export const STITCH_BY_KEY = new Map(STITCHES.map((item) => [item.key, item]));

export function stitchSvg(key: string): string {
  return getStitchSymbol(key);
}

export function svgDataUrl(key: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(stitchSvg(key))}`;
}
