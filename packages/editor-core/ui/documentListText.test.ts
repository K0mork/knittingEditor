import { describe, expect, it } from 'vitest';
import { documentAccessibleName, formatUpdatedAt, msUntilNextDay } from './documentListText';

// 端末の時刻で書くので、期待値も端末の時刻で組み立てる。
const at = (year: number, month: number, day: number, hours = 0, minutes = 0) => new Date(year, month - 1, day, hours, minutes).getTime();
const now = at(2026, 10, 7, 15, 30);

describe('formatUpdatedAt', () => {
  it('shows only the time for today, with zero-padded minutes', () => {
    expect(formatUpdatedAt(at(2026, 10, 7, 14, 5), now)).toBe('今日 14:05');
    expect(formatUpdatedAt(at(2026, 10, 7, 0, 0), now)).toBe('今日 0:00');
  });

  it('says yesterday for the previous calendar day', () => {
    expect(formatUpdatedAt(at(2026, 10, 6, 23, 59), now)).toBe('昨日 23:59');
    expect(formatUpdatedAt(at(2026, 10, 6, 0, 1), now)).toBe('昨日 0:01');
  });

  it('omits the year within the same year', () => {
    expect(formatUpdatedAt(at(2026, 10, 5, 9, 3), now)).toBe('10月5日 9:03');
    expect(formatUpdatedAt(at(2026, 1, 1, 12, 0), now)).toBe('1月1日 12:00');
  });

  it('includes the year for earlier years', () => {
    expect(formatUpdatedAt(at(2025, 12, 31, 18, 45), now)).toBe('2025年12月31日 18:45');
  });

  it('treats the last day of the previous year as yesterday on New Year’s Day', () => {
    expect(formatUpdatedAt(at(2026, 12, 31, 22, 0), at(2027, 1, 1, 8, 0))).toBe('昨日 22:00');
  });
});

describe('documentAccessibleName', () => {
  it('starts with the chart name and reads the size and the update time', () => {
    expect(documentAccessibleName({ name: 'ケーブル模様', rows: 40, cols: 30, updatedAt: at(2026, 10, 7, 9, 0) }, now))
      .toBe('ケーブル模様、40段×30目、更新 今日 9:00');
  });
});

describe('msUntilNextDay', () => {
  it('counts down to the next local midnight', () => {
    expect(msUntilNextDay(at(2026, 10, 7, 23, 59))).toBe(60 * 1000);
    expect(msUntilNextDay(at(2026, 10, 7, 0, 0))).toBe(at(2026, 10, 8) - at(2026, 10, 7));
    expect(msUntilNextDay(at(2026, 12, 31, 12, 0))).toBe(at(2027, 1, 1) - at(2026, 12, 31, 12, 0));
  });
});
