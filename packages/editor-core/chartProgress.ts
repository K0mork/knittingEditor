import { activeMinutesBucket, boardSizeBucket, editDaysBucket, exportLagBucket, gapDaysBucket, progressBucket, type AnalyticsParameters } from './analytics';
import type { Board } from './model/Board';

export const CHART_PROGRESS_KEY = 'knitting-editor:chart-progress:v1';
export const PROGRESS_THRESHOLDS = [20, 100, 500, 2000] as const;
export type ChartOrigin = 'new' | 'restored' | 'duplicated' | 'existing';
export type ExportState = 'unedited' | 'same_state' | 'edited_first' | 'edited_since_export';
export interface ChartProgressRecord {
  baseOccupied: number;
  baseHash: string;
  origin: ChartOrigin;
  maxNet: number;
  reached: Record<string, string>;
  exportedThresholds: number[];
  editDays: number;
  lastEditDay?: string;
  activeMs: number;
  touched: number;
  lastExportHash?: string;
  lastExportAt?: number;
  updatedAt: number;
}
interface Options {
  storage: { read(): string | null; write(value: string): void; remove?(): void };
  send: (name: string, params: AnalyticsParameters) => void;
  now?: () => number;
}
export interface ChartExportToken {
  readonly documentId: string;
  readonly hash: string;
  readonly state: ExportState;
}

/** 端末の暦日。UTCの日付へ丸めない。 */
export function localDay(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function dayTime(day: string): number { return Date.parse(`${day}T00:00:00Z`); }
/** 夏時間による一日の長さの違いを除いて暦日差を返す。 */
export function daysBetween(dayA: string, dayB: string): number { return Math.round((dayTime(dayB) - dayTime(dayA)) / 86_400_000); }
/** ローカル暦日に対応するISO週。 */
export function isoWeek(day: string): string {
  const date = new Date(dayTime(day));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
/** 開始時と出力時だけ全盤面を読む。ハッシュ自体は送信しない。 */
export function boardStateHash(board: Board, backgroundColor: string): string {
  let hash = 0x811c9dc5;
  const byte = (value: number) => { hash = Math.imul(hash ^ (value & 255), 0x01000193); };
  const integer = (value: number) => { for (let shift = 0; shift < 32; shift += 8) byte(value >>> shift); };
  integer(board.rows); integer(board.cols);
  for (const value of board.cells) integer(value);
  integer(board.lines.length);
  // 線の追加順で同じ状態の判定が変わらないようにする。
  for (const line of [...board.lines].sort((a, b) => a.col - b.col || a.top - b.top || a.bottom - b.bottom)) {
    integer(line.col); integer(line.top); integer(line.bottom);
  }
  integer(backgroundColor.length);
  for (let index = 0; index < backgroundColor.length; index++) integer(backgroundColor.charCodeAt(index));
  return (hash >>> 0).toString(16).padStart(8, '0');
}
const origins: ChartOrigin[] = ['new', 'restored', 'duplicated', 'existing'];
function validRecord(value: unknown): value is ChartProgressRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as ChartProgressRecord;
  return [r.baseOccupied, r.maxNet, r.editDays, r.activeMs, r.touched, r.updatedAt].every((n) => Number.isFinite(n) && n >= 0)
    && typeof r.baseHash === 'string' && origins.includes(r.origin)
    && !!r.reached && typeof r.reached === 'object' && !Array.isArray(r.reached)
    && Object.entries(r.reached).every(([key, day]) => PROGRESS_THRESHOLDS.some((n) => String(n) === key) && typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(dayTime(day)))
    && Array.isArray(r.exportedThresholds) && r.exportedThresholds.every((n) => PROGRESS_THRESHOLDS.some((t) => t === n))
    && (r.lastEditDay === undefined || (typeof r.lastEditDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.lastEditDay) && Number.isFinite(dayTime(r.lastEditDay))))
    && (r.lastExportHash === undefined || typeof r.lastExportHash === 'string')
    && (r.lastExportAt === undefined || Number.isFinite(r.lastExportAt));
}
function merge(stored: ChartProgressRecord, local: ChartProgressRecord): ChartProgressRecord {
  const laterDay = (stored.lastEditDay ?? '') > (local.lastEditDay ?? '') ? stored : local;
  const reached = { ...stored.reached };
  for (const [threshold, day] of Object.entries(local.reached)) reached[threshold] = reached[threshold] ? (reached[threshold] < day ? reached[threshold] : day) : day;
  const exported = (stored.lastExportAt ?? -1) > (local.lastExportAt ?? -1) ? stored : local;
  return { ...local, baseOccupied: stored.baseOccupied, baseHash: stored.baseHash, origin: stored.origin,
    maxNet: Math.max(stored.maxNet, local.maxNet), reached,
    exportedThresholds: [...new Set([...stored.exportedThresholds, ...local.exportedThresholds])],
    lastEditDay: laterDay.lastEditDay,
    editDays: stored.lastEditDay === local.lastEditDay ? Math.max(stored.editDays, local.editDays) : laterDay.editDays,
    activeMs: stored.activeMs, touched: stored.touched,
    lastExportHash: exported.lastExportHash, lastExportAt: exported.lastExportAt,
    updatedAt: Math.max(stored.updatedAt, local.updatedAt) };
}

/** 通信・DOMに依存しない端末内の計測。無効な環境ではインスタンスを作らない。 */
export class ChartProgressTracker {
  private records: Record<string, ChartProgressRecord> = Object.create(null);
  private pending = new Map<string, ChartOrigin>();
  private forgotten = new Set<string>();
  private deltas = new Map<string, { activeMs: number; touched: number }>();
  private dirty = false;
  private dirtyAt = 0;
  private activeId?: string;
  private bitmap = new Uint8Array(0);
  private bitmapShape = '';
  private lastActivityAt?: number;
  private clock: () => number;
  constructor(private options: Options) { this.clock = options.now ?? Date.now; this.records = this.read(); }

  private read(): Record<string, ChartProgressRecord> {
    try {
      const raw = this.options.storage.read();
      if (!raw) return Object.create(null);
      const parsed = JSON.parse(raw);
      if (parsed?.v !== 1 || !parsed.charts || typeof parsed.charts !== 'object' || Array.isArray(parsed.charts)
        || !Object.values(parsed.charts).every(validRecord)) {
        this.options.storage.remove?.();
        return Object.create(null);
      }
      return Object.assign(Object.create(null), parsed.charts);
    } catch {
      try { this.options.storage.remove?.(); } catch { /* 保存領域の障害は無視する。 */ }
      return Object.create(null);
    }
  }
  private mark(): void {
    if (!this.dirty) this.dirtyAt = this.clock();
    this.dirty = true;
  }
  private emit(name: string, params: AnalyticsParameters): void { try { this.options.send(name, params); } catch { /* 編集は継続する。 */ } }
  private get active(): ChartProgressRecord | undefined { return this.activeId === undefined ? undefined : this.records[this.activeId]; }
  private delta(): { activeMs: number; touched: number } {
    const id = this.activeId!;
    let delta = this.deltas.get(id);
    if (!delta) { delta = { activeMs: 0, touched: 0 }; this.deltas.set(id, delta); }
    return delta;
  }

  /** 切り替え前の差分を保存し、初見の盤面を基準にする。 */
  open(documentId: string, board: Board, backgroundColor: string, originHint?: ChartOrigin): void {
    this.flush();
    this.activeId = documentId;
    this.lastActivityAt = undefined;
    this.bitmap = new Uint8Array(0); this.bitmapShape = '';
    this.forgotten.delete(documentId);
    const fresh = this.read()[documentId];
    if (fresh) this.records[documentId] = fresh;
    if (!this.records[documentId]) {
      this.records[documentId] = { baseOccupied: board.occupiedStitchCount, baseHash: boardStateHash(board, backgroundColor),
        origin: this.pending.get(documentId) ?? originHint ?? (board.occupiedStitchCount === 0 ? 'new' : 'existing'),
        maxNet: 0, reached: {}, exportedThresholds: [], editDays: 0, activeMs: 0, touched: 0, updatedAt: this.clock() };
      this.mark(); this.flush();
    }
    this.pending.delete(documentId);
  }
  /** 復元・複製などの由来を初回表示まで保持する。 */
  registerOrigin(documentId: string, origin: ChartOrigin): void { this.pending.set(documentId, origin); }
  /** 実際の編集活動間の短い間隔だけを加算する。 */
  activity(now = this.clock()): void {
    const record = this.active;
    if (!record) return;
    const gap = this.lastActivityAt === undefined ? 0 : now - this.lastActivityAt;
    if (gap >= 0 && gap <= 60_000) { record.activeMs += gap; this.delta().activeMs += gap; }
    this.lastActivityAt = now;
    record.updatedAt = now; this.mark();
  }
  /** 呼び出し元が確定した実変更のセル差分だけを渡す。再読込後のtouchedは上限値になる。 */
  forwardEdit(board: Board, changedIndices: Iterable<number> = []): void {
    if (!this.active) return;
    // 日の一度きり判定は保存済みの最新状態と突き合わせる。
    const day = localDay(this.clock());
    if (this.active.lastEditDay !== day) this.flush();
    const record = this.active!;
    this.activity();
    this.prepareBitmap(board, day);
    for (const index of changedIndices) {
      if (Number.isInteger(index) && index >= 0 && index < this.bitmap.length && !this.bitmap[index]) {
        this.bitmap[index] = 1; record.touched++; this.delta().touched++;
      }
    }
    const previousDay = record.lastEditDay;
    if (!previousDay || previousDay < day) {
      record.lastEditDay = day; record.editDays++;
      this.mark();
      // 初日の編集は通常の遅延保存。再開イベントだけは送信前に保存する。
      if (previousDay) this.flush();
      record.maxNet = Math.max(record.maxNet, Math.max(0, board.occupiedStitchCount - record.baseOccupied));
      if (previousDay) this.emit('chart_resumed', { edit_days_bucket: editDaysBucket(record.editDays),
        gap_days_bucket: gapDaysBucket(daysBetween(previousDay, day)), progress_bucket: progressBucket(record.maxNet), chart_origin: record.origin });
    }
    this.updateProgress(board);
  }
  private prepareBitmap(board: Board, day: string): void {
    const shape = `${board.rows}:${board.cols}:${day}`;
    if (shape !== this.bitmapShape) { this.bitmap = new Uint8Array(board.rows * board.cols); this.bitmapShape = shape; }
  }
  /** Undo/Redoは純増の最高値と到達だけを更新する。寸法変更時はセルの重複判定を捨てる。 */
  historyStep(board: Board): void {
    if (!this.active) return;
    this.prepareBitmap(board, localDay(this.clock()));
    this.updateProgress(board);
  }
  private updateProgress(board: Board): void {
    const record = this.active;
    if (!record) return;
    record.maxNet = Math.max(record.maxNet, Math.max(0, board.occupiedStitchCount - record.baseOccupied));
    record.updatedAt = this.clock(); this.mark();
    for (const threshold of PROGRESS_THRESHOLDS) {
      if (record.maxNet < threshold || record.reached[threshold]) continue;
      this.flush();
      const current = this.active!;
      if (current.reached[threshold]) continue;
      const day = localDay(this.clock());
      current.reached[threshold] = day; this.mark(); this.flush();
      this.emit('chart_progress', { progress_threshold: String(threshold), chart_origin: current.origin,
        edit_days_bucket: editDaysBucket(current.editDays), active_minutes_bucket: activeMinutesBucket(current.activeMs),
        touched_cells_bucket: progressBucket(current.touched), board_size_bucket: boardSizeBucket(board.rows, board.cols), cohort_week: isoWeek(day) });
    }
  }
  /** 出力要求時の状態を固定し、キャンセル時はcommitExportを呼ばない。 */
  exportParams(board: Board, backgroundColor: string): { export_state: ExportState; progress_bucket: string; chart_origin: ChartOrigin; token: ChartExportToken } | undefined {
    if (!this.active || this.activeId === undefined) return undefined;
    this.flush();
    const record = this.active!;
    const hash = boardStateHash(board, backgroundColor);
    const state = hash === record.baseHash ? 'unedited' : hash === record.lastExportHash ? 'same_state' : record.lastExportHash === undefined ? 'edited_first' : 'edited_since_export';
    return { export_state: state, progress_bucket: progressBucket(record.maxNet), chart_origin: record.origin,
      token: { documentId: this.activeId, hash, state } };
  }
  /** 保存・共有を取りやめなかった出力だけを記録する。 */
  commitExport(token: ChartExportToken, format: string): void {
    this.flush();
    const record = this.records[token.documentId];
    if (!record) return;
    record.lastExportHash = token.hash; record.lastExportAt = this.clock(); record.updatedAt = this.clock();
    this.mark(); this.flush();
    if (token.state === 'unedited') return;
    for (const threshold of PROGRESS_THRESHOLDS) {
      this.flush();
      const current = this.records[token.documentId];
      const day = current?.reached[threshold];
      if (!day || current.exportedThresholds.includes(threshold)) continue;
      current.exportedThresholds.push(threshold); this.mark(); this.flush();
      this.emit('chart_progress_exported', { progress_threshold: String(threshold), cohort_week: isoWeek(day),
        export_lag_bucket: exportLagBucket(daysBetween(day, localDay(this.clock()))), export_format: format });
    }
  }
  /** 非表示中の時間を次の活動へ持ち越さない。 */
  pause(): void { this.lastActivityAt = undefined; this.flush(); }
  /** ホストのタイマーから呼ぶ。セルごとの同期書き込みを避ける。 */
  flushIfDue(now = this.clock()): void { if (this.dirty && now - this.dirtyAt >= 5_000) this.flush(); }
  /** 最新保存値にこのタブの未保存差分だけを足す。例外時はタブ内の状態を保持する。 */
  flush(): void {
    const fresh = this.read();
    for (const [id, local] of Object.entries(this.records)) {
      const stored = fresh[id];
      if (stored) {
        const delta = this.deltas.get(id);
        fresh[id] = merge(stored, local);
        fresh[id].activeMs += delta?.activeMs ?? 0;
        fresh[id].touched += delta?.touched ?? 0;
      } else fresh[id] = { ...local, reached: { ...local.reached }, exportedThresholds: [...local.exportedThresholds] };
    }
    for (const id of this.forgotten) delete fresh[id];
    const entries = Object.entries(fresh).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 200);
    const merged = Object.assign(Object.create(null), Object.fromEntries(entries)) as Record<string, ChartProgressRecord>;
    // 読み直しは必要だが、変更がなければ書き込まない。
    if (!this.dirty) { this.records = merged; return; }
    this.records = merged;
    try {
      this.options.storage.write(JSON.stringify({ v: 1, charts: merged }));
      this.deltas.clear(); this.forgotten.clear(); this.dirty = false;
    } catch { /* 保存できなくても、このタブでは一度きりの判定を維持する。 */ }
  }
  /** 削除済み編み図の計測記録も削除する。 */
  forget(documentIds: Iterable<string>): void {
    this.flush();
    for (const id of documentIds) {
      delete this.records[id]; this.forgotten.add(id); this.pending.delete(id); this.deltas.delete(id);
      if (this.activeId === id) { this.activeId = undefined; this.bitmap = new Uint8Array(0); this.bitmapShape = ''; this.lastActivityAt = undefined; }
    }
    this.mark(); this.flush();
  }
}
