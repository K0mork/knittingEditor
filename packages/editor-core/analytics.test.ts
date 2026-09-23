import { describe, expect, it } from 'vitest';
import { boardSizeBucket, countBucket } from './analytics';

describe('analytics buckets', () => {
  it('uses stable low-cardinality buckets', () => {
    expect([boardSizeBucket(20, 20), boardSizeBucket(50, 50), boardSizeBucket(100, 100), boardSizeBucket(101, 100)]).toEqual([
      'small', 'medium', 'large', 'xlarge',
    ]);
    expect([countBucket(1), countBucket(3), countBucket(9), countBucket(10)]).toEqual(['1', '2-3', '4-9', '10+']);
  });
});
