import { glyphSvg, getGlyphDefinition, type GlyphDefinition } from './glyphs';

export const STITCH_CATALOG_VERSION = 3;
export type StitchCategory = 'basic' | 'decrease' | 'cable' | 'twist' | 'utility';
export type StitchStandardStatus = 'jis' | 'jis-derived' | 'extension' | 'utility';

export interface StitchDefinition {
  id: number;
  key: string;
  name: string;
  width: number;
  height: number;
  consumes: number;
  produces: number;
  category: StitchCategory;
  standardStatus: StitchStandardStatus;
  standardReference: string;
  renderKind: 'glyph' | 'whiteout';
  glyph?: GlyphDefinition;
  svg: string;
}

type DefinitionInput = Omit<StitchDefinition, 'svg' | 'glyph' | 'renderKind'> & { renderKind?: StitchDefinition['renderKind'] };

const definitions: DefinitionInput[] = [
  // idは編み図とバックアップに保存される永続値。変更・再利用しないこと。
  { id: 1, key: 'knit', name: '表目', width: 1, height: 1, consumes: 1, produces: 1, category: 'basic', standardStatus: 'jis', standardReference: 'JIS 2010' },
  { id: 2, key: 'purl', name: '裏目', width: 1, height: 1, consumes: 1, produces: 1, category: 'basic', standardStatus: 'jis', standardReference: 'JIS 2020' },
  { id: 3, key: 'yo', name: 'かけ目', width: 1, height: 1, consumes: 0, produces: 1, category: 'basic', standardStatus: 'jis', standardReference: 'JIS 2030' },
  { id: 4, key: 'right_up_two_one', name: '右上2目一度', width: 2, height: 1, consumes: 2, produces: 1, category: 'decrease', standardStatus: 'jis', standardReference: 'JIS 2040' },
  { id: 5, key: 'left_up_two_one', name: '左上2目一度', width: 2, height: 1, consumes: 2, produces: 1, category: 'decrease', standardStatus: 'jis', standardReference: 'JIS 2050' },
  { id: 26, key: 'purl_right_up_two_one', name: '裏目の右上2目一度', width: 2, height: 1, consumes: 2, produces: 1, category: 'decrease', standardStatus: 'jis-derived', standardReference: 'JIS 2040・備考2' },
  { id: 6, key: 'purl_left_up_two_one', name: '裏目の左上2目一度', width: 2, height: 1, consumes: 2, produces: 1, category: 'decrease', standardStatus: 'jis-derived', standardReference: 'JIS 2050・備考2' },
  { id: 7, key: 'right_cross', name: '右上交差', width: 2, height: 1, consumes: 2, produces: 2, category: 'cable', standardStatus: 'jis', standardReference: 'JIS 2120' },
  { id: 8, key: 'left_cross', name: '左上交差', width: 2, height: 1, consumes: 2, produces: 2, category: 'cable', standardStatus: 'jis', standardReference: 'JIS 2130' },
  { id: 9, key: 'purl_right_cross', name: '裏目右上交差', width: 2, height: 1, consumes: 2, produces: 2, category: 'cable', standardStatus: 'jis-derived', standardReference: 'JIS 2120・備考2' },
  { id: 10, key: 'purl_left_cross', name: '裏目左上交差', width: 2, height: 1, consumes: 2, produces: 2, category: 'cable', standardStatus: 'jis-derived', standardReference: 'JIS 2130・備考2' },
  { id: 11, key: 'purl_right_up_two_cross', name: '裏目右上2×1交差', width: 3, height: 1, consumes: 3, produces: 3, category: 'cable', standardStatus: 'extension', standardReference: 'JIS交差記号の拡張' },
  { id: 12, key: 'purl_left_up_two_cross', name: '裏目左上2×1交差', width: 3, height: 1, consumes: 3, produces: 3, category: 'cable', standardStatus: 'extension', standardReference: 'JIS交差記号の拡張' },
  { id: 13, key: 'purl_right_cross_twist_stitch', name: '裏目右上ねじり目交差', width: 2, height: 1, consumes: 2, produces: 2, category: 'cable', standardStatus: 'extension', standardReference: 'JIS交差・ねじり目の複合' },
  { id: 14, key: 'purl_left_cross_twist_stitch', name: '裏目左上ねじり目交差', width: 2, height: 1, consumes: 2, produces: 2, category: 'cable', standardStatus: 'extension', standardReference: 'JIS交差・ねじり目の複合' },
  { id: 15, key: 'middle_up_three_one', name: '中上3目一度', width: 3, height: 1, consumes: 3, produces: 1, category: 'decrease', standardStatus: 'jis', standardReference: 'JIS 2060' },
  { id: 16, key: 'right_up_three_one', name: '右上3目一度', width: 3, height: 1, consumes: 3, produces: 1, category: 'decrease', standardStatus: 'jis', standardReference: 'JIS 2070' },
  { id: 17, key: 'left_up_three_one', name: '左上3目一度', width: 3, height: 1, consumes: 3, produces: 1, category: 'decrease', standardStatus: 'jis', standardReference: 'JIS 2080' },
  { id: 18, key: 'right_up_two_cross', name: '右上2目交差', width: 4, height: 1, consumes: 4, produces: 4, category: 'cable', standardStatus: 'extension', standardReference: 'JIS交差記号の拡張' },
  { id: 19, key: 'left_up_two_cross', name: '左上2目交差', width: 4, height: 1, consumes: 4, produces: 4, category: 'cable', standardStatus: 'extension', standardReference: 'JIS交差記号の拡張' },
  { id: 20, key: 'right_up_three_cross', name: '右上3目交差', width: 6, height: 1, consumes: 6, produces: 6, category: 'cable', standardStatus: 'extension', standardReference: 'JIS交差記号の拡張' },
  { id: 21, key: 'left_up_three_cross', name: '左上3目交差', width: 6, height: 1, consumes: 6, produces: 6, category: 'cable', standardStatus: 'extension', standardReference: 'JIS交差記号の拡張' },
  { id: 22, key: 'slip_stitch', name: 'すべり目', width: 1, height: 2, consumes: 1, produces: 1, category: 'basic', standardStatus: 'jis', standardReference: 'JIS 2160' },
  { id: 23, key: 'twist_stitch', name: 'ねじり目', width: 1, height: 1, consumes: 1, produces: 1, category: 'twist', standardStatus: 'jis', standardReference: 'JIS 2200' },
  { id: 24, key: 'purl_twist_stitch', name: 'ねじり裏目', width: 1, height: 1, consumes: 1, produces: 1, category: 'twist', standardStatus: 'jis-derived', standardReference: 'JIS 2200・備考2' },
  { id: 25, key: 'erase', name: '白くする', width: 1, height: 1, consumes: 1, produces: 1, category: 'utility', standardStatus: 'utility', standardReference: '補助・JIS外', renderKind: 'whiteout' },
];

export const STITCH_STANDARD_LABELS: Record<StitchStandardStatus, string> = {
  jis: 'JIS',
  'jis-derived': 'JIS派生',
  extension: '拡張',
  utility: '補助・JIS外',
};

export const STITCH_CATEGORY_LABELS: Record<StitchCategory, string> = {
  basic: '基本', decrease: '減目', cable: '交差', twist: 'ねじり目', utility: '補助',
};

export const STITCHES: StitchDefinition[] = definitions.map((item) => ({
  ...item,
  renderKind: item.renderKind ?? 'glyph',
  glyph: getGlyphDefinition(item.key),
  svg: glyphSvg(item.key),
}));
export const STITCH_BY_ID = new Map(STITCHES.map((item) => [item.id, item]));
export const STITCH_BY_KEY = new Map(STITCHES.map((item) => [item.key, item]));
// 旧版バックアップ内の綴り間違いを読み込むための互換名。
STITCH_BY_KEY.set('purl_twisst_stitch', STITCH_BY_ID.get(24)!);

export function stitchSvg(key: string): string {
  return STITCH_BY_KEY.get(key)?.svg ?? '';
}

export function svgDataUrl(key: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(stitchSvg(key))}`;
}
