import { describe, it, expect } from 'vitest';
import { fuzzyMatch, fuzzyScore } from './fuzzy.js';

describe('fuzzyMatch', () => {
  it('matches substring case-insensitive', () => {
    expect(fuzzyMatch('信義公務中心停車場', '信義')).toBe(true);
  });
  it('matches in-order chars', () => {
    expect(fuzzyMatch('台北101購物中心', '101心')).toBe(true);
  });
  it('rejects unordered chars', () => {
    expect(fuzzyMatch('台北101', '101台')).toBe(false);
  });
  it('strips punctuation and brackets', () => {
    expect(fuzzyMatch('松山（東）停車場', '松山東')).toBe(true);
  });
});

describe('fuzzyScore', () => {
  it('substring scores higher than scattered', () => {
    expect(fuzzyScore('信義公務中心', '信義')).toBeGreaterThan(fuzzyScore('信公心義', '信義'));
  });
  it('returns -1 for no match', () => {
    expect(fuzzyScore('松山', '基隆')).toBe(-1);
  });
});
