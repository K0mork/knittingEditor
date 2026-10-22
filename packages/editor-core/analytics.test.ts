import { describe, expect, it } from 'vitest';
import { activeMinutesBucket, boardSizeBucket, countBucket, editDaysBucket, exportLagBucket, gapDaysBucket, progressBucket } from './analytics';

describe('analytics buckets', () => {
  it('uses stable low-cardinality buckets', () => {
    expect([boardSizeBucket(20, 20), boardSizeBucket(50, 50), boardSizeBucket(100, 100), boardSizeBucket(101, 100)]).toEqual([
      'small', 'medium', 'large', 'xlarge',
    ]);
    expect([countBucket(1), countBucket(3), countBucket(9), countBucket(10)]).toEqual(['1', '2-3', '4-9', '10+']);
  });
});


describe('chart progress buckets', () => {
  it('covers every boundary', () => {
    expect([0, 1, 19, 20, 99, 100, 499, 500, 1999, 2000].map(progressBucket)).toEqual(['0', '1-19', '1-19', '20-99', '20-99', '100-499', '100-499', '500-1999', '500-1999', '2000+']);
    expect([1, 2, 3, 4, 5, 9, 10].map(editDaysBucket)).toEqual(['1', '2', '3-4', '3-4', '5-9', '5-9', '10+']);
    expect([1, 2, 6, 7, 29, 30].map(gapDaysBucket)).toEqual(['1', '2-6', '2-6', '7-29', '7-29', '30+']);
    expect([0, 59_999, 60_000, 299_999, 300_000, 899_999, 900_000, 3_599_999, 3_600_000].map(activeMinutesBucket)).toEqual(['0', '0', '1-4', '1-4', '5-14', '5-14', '15-59', '15-59', '60+']);
    expect([0, 1, 6, 7, 29, 30].map(exportLagBucket)).toEqual(['0', '1-6', '1-6', '7-29', '7-29', '30+']);
  });
});
