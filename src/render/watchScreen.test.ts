import { describe, it, expect } from 'vitest';
import { renderScreen } from './watchScreen.js';

const fixedNow = new Date('2026-05-13T21:43:11+08:00');
const fixedUpdate1 = new Date('2026-05-13T21:42:38+08:00');
const fixedUpdate2 = new Date('2026-05-13T21:42:40+08:00');

describe('renderScreen', () => {
  it('snapshot: mixed normal + low + error rows', () => {
    const out = renderScreen({
      now: fixedNow,
      intervalSec: 60,
      width: 120,
      views: [
        {
          city: '台北',
          id: 'A1',
          name: '信義公務中心',
          totalSpaces: 250,
          availability: {
            city: '台北',
            id: 'A1',
            availableSpaces: 12,
            updatedAt: fixedUpdate1,
          },
        },
        {
          city: '台北',
          id: 'B2',
          name: '101 購物中心',
          totalSpaces: 1843,
          availability: {
            city: '台北',
            id: 'B2',
            availableSpaces: 3,
            updatedAt: fixedUpdate2,
          },
        },
        { city: '桃園', id: 'C3', name: '中路停車場', fetchError: 'timeout' },
      ],
    });
    expect(out).toMatchSnapshot();
  });

  it('adds persistent failures hint to header', () => {
    const out = renderScreen({
      now: fixedNow,
      intervalSec: 60,
      width: 80,
      views: [{ city: '基隆', id: 'X', name: 'Y', fetchError: 'down' }],
      persistentFailures: ['基隆'],
    });
    expect(out.split('\n')[0]).toContain('(基隆 持續失敗)');
  });
});
