import { describe, expect, it } from 'vitest';
import { formatDateChinese, getInitial, percent } from './format';

describe('format utilities', () => {
  it('calculates bounded percentages', () => {
    expect(percent(3, 4)).toBe(75);
    expect(percent(0, 0)).toBe(0);
    expect(percent(5, 4)).toBe(125);
  });

  it('formats Chinese dates', () => {
    expect(formatDateChinese('2026-11-09')).toBe('11月9日');
  });

  it('uses the last Chinese character as avatar text', () => {
    expect(getInitial('陈思远')).toBe('远');
    expect(getInitial('  ')).toBe('?');
  });
});
