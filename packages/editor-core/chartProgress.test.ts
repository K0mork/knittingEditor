import { describe, expect, it, vi } from 'vitest';
import { Board } from './model/Board';
import { boardStateHash, ChartProgressTracker, daysBetween, isoWeek, localDay } from './chartProgress';

function setup() {
  let raw: string | null = null;
  let time = new Date(2026, 9, 19, 12).getTime();
  const storage = { read: () => raw, write: vi.fn((value: string) => { raw = value; }), remove: () => { raw = null; } };
  const send = vi.fn();
  const make = () => new ChartProgressTracker({ storage, send, now: () => time });
  return { storage, send, make, tracker: make(), setTime: (value: number) => { time = value; }, advance: (ms: number) => { time += ms; },
    record: (id = 'a') => JSON.parse(raw!).charts[id], raw: () => raw };
}
function fill(board: Board, count: number, offset = 0) {
  const indices: number[] = [];
  for (let index = offset; index < offset + count; index++) {
    board.place(Math.floor(index / board.cols), index % board.cols, 'knit', '#000', false); indices.push(index);
  }
  return indices;
}
function events(s: ReturnType<typeof setup>, name: string) { return s.send.mock.calls.filter(([event]) => event === name).map(([, params]) => params); }

describe('chart progress', () => {
  it('counts net progress rather than repeated toggles, erased work or undo activity', () => {
    const s = setup(); const b = new Board(); s.tracker.open('a', b, '#fff');
    for (let i = 0; i < 60; i++) { b.place(0, 0, 'knit', '#000'); s.tracker.forwardEdit(b, [0]); }
    fill(b, 19); s.tracker.forwardEdit(b, Array.from({ length: 19 }, (_, i) => i));
    b.clear(); s.tracker.forwardEdit(b); s.tracker.historyStep(b);
    expect(events(s, 'chart_progress')).toHaveLength(0);
    s.tracker.forwardEdit(b, fill(b, 20));
    s.tracker.historyStep(b); b.clear(); s.tracker.historyStep(b);
    expect(events(s, 'chart_progress')).toEqual([expect.objectContaining({ progress_threshold: '20', chart_origin: 'new' })]);
    expect(s.record().maxNet).toBe(20);
  });
  it('emits every crossed threshold exactly once for a large paste', () => {
    const s = setup(); const b = new Board(30, 30); s.tracker.open('a', b, '#fff');
    s.tracker.forwardEdit(b, fill(b, 600)); s.tracker.forwardEdit(b);
    expect(events(s, 'chart_progress').map((p) => p.progress_threshold)).toEqual(['20', '100', '500']);
  });
  it('classifies all export states and emits each reached export once with cohort and lag', () => {
    const s = setup(); const b = new Board(); s.tracker.open('a', b, '#fff');
    const blank = s.tracker.exportParams(b, '#fff')!;
    expect(blank.export_state).toBe('unedited'); s.tracker.commitExport(blank.token, 'png');
    s.tracker.forwardEdit(b, fill(b, 20));
    expect(s.tracker.exportParams(b, '#fff')!.export_state).toBe('edited_since_export');
    const cancelled = s.tracker.exportParams(b, '#fff')!;
    expect(events(s, 'chart_progress_exported')).toHaveLength(0);
    s.advance(6 * 86_400_000); s.tracker.commitExport(cancelled.token, 'pdf');
    expect(events(s, 'chart_progress_exported')).toEqual([{ progress_threshold: '20', cohort_week: '2026-W43', export_lag_bucket: '0', export_format: 'pdf' }]);
    const same = s.tracker.exportParams(b, '#fff')!; expect(same.export_state).toBe('same_state');
    s.tracker.commitExport(same.token, 'png'); expect(events(s, 'chart_progress_exported')).toHaveLength(1);
    b.place(1, 1, 'purl', '#000', false); s.tracker.forwardEdit(b, [21]);
    expect(s.tracker.exportParams(b, '#fff')!.export_state).toBe('edited_since_export');
    s.tracker.open('fresh', new Board(), '#fff');
    const fresh = new Board(); fill(fresh, 1); s.tracker.forwardEdit(fresh, [0]);
    expect(s.tracker.exportParams(fresh, '#fff')!.export_state).toBe('edited_first');
    s.tracker.open('existing', b, '#fff'); expect(s.tracker.exportParams(b, '#fff')!.export_state).toBe('unedited');
  });
  it('does not mark reached thresholds exported when the baseline is restored', () => {
    const s = setup(); const b = new Board(); s.tracker.open('a', b, '#fff'); s.tracker.forwardEdit(b, fill(b, 20));
    b.clear(); s.tracker.historyStep(b); const result = s.tracker.exportParams(b, '#fff')!;
    s.tracker.commitExport(result.token, 'png'); expect(events(s, 'chart_progress_exported')).toHaveLength(0);
  });
  it('uses local midnight, counts forward edit days once, and excludes undo days', () => {
    const s = setup(); const b = new Board();
    s.setTime(new Date(2026, 9, 19, 23, 59).getTime()); s.tracker.open('a', b, '#fff'); s.tracker.forwardEdit(b, fill(b, 1));
    s.setTime(new Date(2026, 9, 20, 0, 1).getTime()); s.tracker.historyStep(b); s.tracker.flush();
    expect(s.record().editDays).toBe(1);
    s.tracker.forwardEdit(b, fill(b, 1, 1)); s.tracker.forwardEdit(b, fill(b, 1, 2));
    expect(events(s, 'chart_resumed')).toEqual([expect.objectContaining({ edit_days_bucket: '2', gap_days_bucket: '1' })]);
    s.advance(7 * 86_400_000); s.tracker.forwardEdit(b);
    expect(events(s, 'chart_resumed')[1]).toMatchObject({ edit_days_bucket: '3-4', gap_days_bucket: '7-29' });
  });
  it('continues baselines, milestones, edit days and export hash after reload', () => {
    const s = setup(); const b = new Board(); s.tracker.open('a', b, '#fff'); s.tracker.forwardEdit(b, fill(b, 20));
    s.tracker.commitExport(s.tracker.exportParams(b, '#fff')!.token, 'png');
    const next = s.make(); next.open('a', b, '#fff'); next.forwardEdit(b);
    expect(next.exportParams(b, '#fff')!.export_state).toBe('same_state');
    next.flush(); expect(s.record()).toMatchObject({ baseOccupied: 0, maxNet: 20, editDays: 1 });
    expect(events(s, 'chart_progress')).toHaveLength(1);
  });
  it('merges two tabs with additive deltas and deduplicated day/milestone/export events', () => {
    const s = setup(); const a = s.tracker; const b = s.make(); const board = new Board();
    a.open('a', board, '#fff'); b.open('a', board, '#fff'); fill(board, 20);
    a.forwardEdit(board, [0]); b.forwardEdit(board, [0]); s.advance(1000);
    a.activity(); b.activity(); a.flush(); b.flush();
    expect(s.record()).toMatchObject({ activeMs: 2000, touched: 2, editDays: 1 });
    expect(events(s, 'chart_progress')).toHaveLength(1);
    s.advance(86_400_000); a.forwardEdit(board, [1]); b.forwardEdit(board, [1]);
    expect(events(s, 'chart_resumed')).toHaveLength(1);
    const ta = a.exportParams(board, '#fff')!.token; const tb = b.exportParams(board, '#fff')!.token;
    a.commitExport(ta, 'png'); b.commitExport(tb, 'png'); expect(events(s, 'chart_progress_exported')).toHaveLength(1);
  });
  it.each(['restored', 'duplicated', 'existing'] as const)('excludes existing content for %s origins', (origin) => {
    const s = setup(); const b = new Board(); fill(b, 100);
    s.tracker.registerOrigin('a', origin); s.tracker.open('a', b, '#fff'); s.tracker.forwardEdit(b, fill(b, 20, 100));
    expect(events(s, 'chart_progress')[0]).toMatchObject({ chart_origin: origin, progress_threshold: '20' }); expect(s.record().baseOccupied).toBe(100);
  });
  it('excludes idle, hidden and chart switch time; batches ordinary writes', () => {
    const s = setup(); const b = new Board(); s.tracker.open('a', b, '#fff'); s.tracker.forwardEdit(b, fill(b, 1)); s.tracker.flush();
    s.storage.write.mockClear(); s.advance(1000); s.tracker.forwardEdit(b, [0]); s.tracker.flushIfDue(); expect(s.storage.write).not.toHaveBeenCalled();
    s.advance(5000); s.tracker.flushIfDue(); expect(s.storage.write).toHaveBeenCalledTimes(1);
    s.advance(61_000); s.tracker.activity(); s.tracker.pause(); s.advance(1000); s.tracker.activity(); s.tracker.flush();
    expect(s.record().activeMs).toBe(1000);
    s.tracker.open('b', b, '#fff'); s.advance(1000); s.tracker.activity(); s.tracker.flush(); expect(s.record('b').activeMs).toBe(0);
  });
  it('resets touched on day, shape or active chart changes', () => {
    const s = setup(); const b = new Board(); s.tracker.open('a', b, '#fff');
    s.tracker.forwardEdit(b, [0, 0, -1, 5000]); s.tracker.forwardEdit(b, [0]); s.tracker.flush(); expect(s.record().touched).toBe(1);
    b.resize(10, 40); s.tracker.forwardEdit(b, [0]); s.tracker.flush(); expect(s.record().touched).toBe(2);
    s.advance(86_400_000); s.tracker.forwardEdit(b, [0]); s.tracker.flush(); expect(s.record().touched).toBe(3);
  });
  it('contains storage, quota, parse and sender failures with tab-local dedupe', () => {
    const board = new Board(); const send = vi.fn((_name: string) => { throw new Error('sender'); });
    const tracker = new ChartProgressTracker({ storage: { read: () => { throw new Error('read'); }, write: () => { throw new Error('quota'); } }, send });
    expect(() => { tracker.open('a', board, '#fff'); tracker.forwardEdit(board, fill(board, 20)); tracker.historyStep(board);
      tracker.commitExport(tracker.exportParams(board, '#fff')!.token, 'png'); tracker.pause(); tracker.forget(['a']); }).not.toThrow();
    expect(send.mock.calls.filter(([name]) => name === 'chart_progress')).toHaveLength(1);
    for (const raw of ['{', '{"v":1,"charts":{"a":{}}}', 'null']) {
      const t = new ChartProgressTracker({ storage: { read: () => raw, write: () => {} }, send: () => {} });
      expect(() => { t.open('a', board, '#fff'); t.forwardEdit(board); t.flush(); }).not.toThrow();
    }
  });
  it('preserves unflushed deltas through quota errors without adding them twice on recovery', () => {
    const s = setup(); const board = new Board(); s.tracker.open('a', board, '#fff');
    s.tracker.forwardEdit(board, [0]); s.tracker.flush();
    const write = s.storage.write.getMockImplementation()!;
    s.storage.write.mockImplementation(() => { throw new Error('quota'); });
    s.advance(1000); s.tracker.forwardEdit(board, [1]); s.tracker.flush(); s.tracker.flush();
    s.storage.write.mockImplementation(write); s.tracker.flush(); s.tracker.flush();
    expect(s.record()).toMatchObject({ touched: 2, activeMs: 1000 });
    s.storage.write.mockImplementation(() => { throw new Error('quota'); }); s.tracker.forget(['a']);
    s.storage.write.mockImplementation(write); s.tracker.flush(); expect(s.record()).toBeUndefined();
  });
  it('evicts the least recently updated records and forgets deleted charts', () => {
    const s = setup(); const board = new Board(1, 1);
    for (let i = 0; i < 205; i++) { s.advance(1); s.tracker.open(`chart${i}`, board, '#fff'); }
    s.tracker.flush(); expect(Object.keys(JSON.parse(s.raw()!).charts)).toHaveLength(200);
    expect(s.record('chart0')).toBeUndefined(); s.tracker.forget(['chart204', 'chart203']); expect(s.record('chart204')).toBeUndefined();
    s.tracker.flush(); expect(Object.keys(JSON.parse(s.raw()!).charts)).toHaveLength(198);
  });
  it('binds export thresholds and lag to the request snapshot and keeps the newest export hash', () => {
    const s = setup(); const board = new Board(); s.tracker.open('a', board, '#fff');
    s.tracker.forwardEdit(board, fill(board, 1));
    const old = s.tracker.exportParams(board, '#fff')!.token;
    s.advance(1000); s.tracker.forwardEdit(board, fill(board, 19, 1));
    s.tracker.commitExport(old, 'png');
    expect(events(s, 'chart_progress_exported')).toHaveLength(0);
    const reached = s.tracker.exportParams(board, '#fff')!.token;
    s.advance(86_400_000); s.tracker.forwardEdit(board, fill(board, 1, 20));
    const newest = s.tracker.exportParams(board, '#fff')!.token;
    s.tracker.commitExport(newest, 'png'); s.tracker.commitExport(reached, 'pdf');
    expect(s.record()).toMatchObject({ lastExportHash: newest.hash, lastExportAt: newest.requestedAt });
    expect(s.tracker.exportParams(board, '#fff')!.export_state).toBe('same_state');
    expect(events(s, 'chart_progress_exported')).toHaveLength(1);
  });
  it('does not resurrect a record deleted by another tab on unrelated edits or a late export', () => {
    const s = setup(); const board = new Board(); s.tracker.open('a', board, '#fff');
    const other = s.make(); other.open('a', board, '#fff');
    const token = other.exportParams(board, '#fff')!.token;
    other.open('b', board, '#fff'); s.tracker.forget(['a']);
    other.forwardEdit(board, [0]); other.flush(); other.commitExport(token, 'png');
    expect(s.record()).toBeUndefined(); expect(s.record('b').touched).toBe(1);
  });
  it('does not resurrect a record evicted by another tab', () => {
    const s = setup(); const board = new Board(1, 1); s.tracker.open('a', board, '#fff');
    const other = s.make(); other.open('a', board, '#fff'); other.open('b', board, '#fff');
    for (let i = 0; i < 200; i++) { s.advance(1); s.tracker.open(`new${i}`, board, '#fff'); }
    other.forwardEdit(board, [0]); other.flush();
    expect(s.record()).toBeUndefined(); expect(s.record('b')).toBeUndefined();
    expect(Object.keys(JSON.parse(s.raw()!).charts)).toHaveLength(200);
  });
  it('preserves unsaved milestones, days, exports and deltas when reopening during quota failures', () => {
    const s = setup(); const board = new Board(); s.tracker.open('a', board, '#fff');
    const write = s.storage.write.getMockImplementation()!;
    s.storage.write.mockImplementation(() => { throw new Error('quota'); });
    s.tracker.forwardEdit(board, fill(board, 20));
    s.advance(1000); s.tracker.forwardEdit(board, [20]);
    const token = s.tracker.exportParams(board, '#fff')!.token; s.tracker.commitExport(token, 'png');
    s.advance(86_400_000); s.tracker.forwardEdit(board, [21]);
    s.tracker.open('b', new Board(), '#fff'); s.tracker.open('a', board, '#fff');
    s.tracker.forwardEdit(board); s.tracker.commitExport(token, 'png');
    expect(s.tracker.exportParams(board, '#fff')!.export_state).toBe('same_state');
    s.storage.write.mockImplementation(write); s.tracker.forwardEdit(board); s.tracker.flush(); s.tracker.flush();
    expect(events(s, 'chart_progress')).toHaveLength(1);
    expect(events(s, 'chart_progress_exported')).toHaveLength(1);
    expect(events(s, 'chart_resumed')).toHaveLength(1);
    expect(s.record()).toMatchObject({ editDays: 2, touched: 22, activeMs: 1000, lastExportHash: token.hash });
  });
  it.each(['restored', 'duplicated'] as const)('persists %s origin and baseline before first open', (origin) => {
    const s = setup(); const board = new Board(); fill(board, 100);
    s.tracker.registerOrigin('a', origin, board, '#abcdef');
    expect(s.record()).toMatchObject({ origin, baseOccupied: 100, baseHash: boardStateHash(board, '#abcdef') });
    const reloaded = s.make(); reloaded.open('a', board, '#abcdef');
    expect(reloaded.exportParams(board, '#abcdef')!.export_state).toBe('unedited');
    reloaded.forwardEdit(board, fill(board, 20, 100));
    expect(events(s, 'chart_progress')[0]).toMatchObject({ chart_origin: origin, progress_threshold: '20' });
  });
  it('does not read any board cells during 1000 small edits on a million-cell board', () => {
    const s = setup(); const board = new Board(1000, 1000); s.tracker.open('a', board, '#fff');
    const cells = board.cells; let reads = 0;
    Object.defineProperty(board, 'cells', { get: () => { reads++; return cells; } });
    for (let i = 0; i < 1000; i++) { board.place(0, i, 'knit', '#000', false); reads = 0; s.tracker.forwardEdit(board, [i]); expect(reads).toBe(0); }
  });
});
describe('calendar and board hashes', () => {
  it('handles ISO year boundaries and local dates', () => {
    expect(isoWeek('2021-01-01')).toBe('2020-W53'); expect(isoWeek('2024-12-30')).toBe('2025-W01');
    expect(daysBetween('2024-03-09', '2024-03-11')).toBe(2);
    expect(localDay(new Date(2026, 0, 2, 0, 1).getTime())).toBe('2026-01-02');
  });
  it('hashes cells, dimensions, guide lines and background deterministically', () => {
    const b = new Board(); const initial = boardStateHash(b, '#fff'); expect(initial).toMatch(/^[0-9a-f]{8}$/);
    expect(boardStateHash(new Board(), '#fff')).toBe(initial);
    expect(boardStateHash(b, '#000')).not.toBe(initial);
    fill(b, 1); expect(boardStateHash(b, '#fff')).not.toBe(initial); b.clear();
    b.addLine(1, 0, 2); expect(boardStateHash(b, '#fff')).not.toBe(initial); b.clear();
    b.resize(10, 40); expect(boardStateHash(b, '#fff')).not.toBe(initial);
  });
});

it('registers a large restore batch with bounded writes and at most 200 records', () => {
  const s = setup();
  const board = new Board();
  fill(board, 20);
  s.tracker.registerOrigins(Array.from({ length: 300 }, (_, i) => ({
    documentId: `restored-${i}`, board, backgroundColor: '#ffffff',
  })), 'restored');
  expect(s.storage.write.mock.calls.length).toBeLessThanOrEqual(2);
  const records = Object.values(JSON.parse(s.raw()!).charts);
  expect(records).toHaveLength(200);
  for (const record of records) expect(record).toMatchObject({ origin: 'restored', baseOccupied: 20, maxNet: 0 });
});

it('tracks the first chart opened after restoring over 200 records with an advancing clock', () => {
  const s = setup(); let time = new Date(2026, 9, 19, 12).getTime();
  const tracker = new ChartProgressTracker({ storage: s.storage, send: s.send, now: () => time++ });
  const board = new Board(); fill(board, 100);
  tracker.registerOrigins(Array.from({ length: 201 }, (_, i) => ({ documentId: `r${i}`, board, backgroundColor: '#fff' })), 'restored');
  expect(s.record('r0')).toBeUndefined();
  tracker.open('r0', board, '#fff');
  expect(tracker.exportParams(board, '#fff')).toMatchObject({ export_state: 'unedited', progress_bucket: '0' });
  tracker.forwardEdit(board, fill(board, 20, 100));
  expect(s.record('r0')).toMatchObject({ baseOccupied: 100, maxNet: 20 });
  expect(events(s, 'chart_progress')).toHaveLength(1);
  expect(Object.keys(JSON.parse(s.raw()!).charts)).toHaveLength(200);
});

it('starts a fresh baseline when explicitly revisiting a chart evicted by another tab', () => {
  const s = setup(); const board = new Board(); s.tracker.open('a', board, '#fff');
  s.tracker.forwardEdit(board, fill(board, 20));
  const other = s.make();
  for (let i = 0; i < 200; i++) { s.advance(1); other.open(`new${i}`, new Board(1, 1), '#fff'); }
  s.tracker.flush(); expect(s.record()).toBeUndefined();
  s.advance(1); s.tracker.open('a', board, '#fff');
  expect(s.tracker.exportParams(board, '#fff')).toMatchObject({ export_state: 'unedited', progress_bucket: '0' });
  expect(s.record()).toMatchObject({ baseOccupied: 20, maxNet: 0, touched: 0, reached: {} });
  s.tracker.forwardEdit(board, fill(board, 20, 20));
  expect(s.record().maxNet).toBe(20);
  expect(events(s, 'chart_progress')).toHaveLength(2);
  expect(Object.keys(JSON.parse(s.raw()!).charts)).toHaveLength(200);
});

it('keeps the newest export hash when same-millisecond requests complete in reverse order', () => {
  const s = setup(); const board = new Board(); s.tracker.open('a', board, '#fff');
  s.tracker.forwardEdit(board, fill(board, 20));
  const older = s.tracker.exportParams(board, '#fff')!.token;
  s.tracker.forwardEdit(board, fill(board, 1, 20));
  const newer = s.tracker.exportParams(board, '#fff')!.token;
  expect(newer.requestedAt).toBeGreaterThan(older.requestedAt);
  s.advance(7 * 86_400_000);
  s.tracker.commitExport(newer, 'png'); s.tracker.commitExport(older, 'pdf');
  expect(s.record()).toMatchObject({ lastExportHash: newer.hash, lastExportAt: newer.requestedAt });
  expect(s.tracker.exportParams(board, '#fff')!.export_state).toBe('same_state');
  expect(events(s, 'chart_progress_exported')).toEqual([expect.objectContaining({ export_lag_bucket: '0' })]);
});
