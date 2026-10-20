import { cellStitchId } from '../model/Board';
import { STITCHES, type StitchDefinition } from '../stitches/catalog';

export interface ExportAnnotations {
  includeTitleAndLegend?: boolean;
  title?: string;
  legendCount?: number;
  legendHeights?: number[];
}

/** 起点のpacked値だけを走査し、色・占有セル数によらず各記号を一度だけ載せる。 */
export function usedStitches(cells: Uint32Array): StitchDefinition[] {
  const ids = new Set<number>();
  for (const value of cells) if (value) ids.add(cellStitchId(value));
  return STITCHES.filter((stitch) => stitch.renderKind === 'glyph' && ids.has(stitch.id));
}

export function annotationHeights(options: ExportAnnotations, rowHeight: number, legendRowHeight = rowHeight) {
  return options.includeTitleAndLegend
    ? { titleHeight: rowHeight, legendHeight: Math.ceil((options.legendCount ?? 0) / 2) * legendRowHeight + legendRowHeight / 2 }
    : { titleHeight: 0, legendHeight: 0 };
}

/** 記号の一覧の末尾に、使われている線の見本を1件加える。 */
export function exportLegend(cells: Uint32Array, hasLines: boolean): Pick<StitchDefinition, 'id' | 'key' | 'name' | 'height' | 'width'>[] {
  return [...usedStitches(cells), ...(hasLines ? [{ name: '線', key: 'guide-line', id: 0, height: 2, width: 1 }] : [])];
}
