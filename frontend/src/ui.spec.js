import {describe, test, expect} from 'vitest';
import {stayLength, count, money, dateLabel} from './ui.jsx';

describe('ui helpers', () => {
  // 9
  test('stayLength counts nights between two dates', () => {
    expect(stayLength('2030-01-10', '2030-01-13')).toBe(3);
    expect(stayLength('2030-02-27', '2030-03-01')).toBe(2);
  });

  // 10
  test('count uses the right Russian word form', () => {
    expect(count(1, 'ночь', 'ночи', 'ночей')).toBe('1 ночь');
    expect(count(3, 'ночь', 'ночи', 'ночей')).toBe('3 ночи');
    expect(count(5, 'ночь', 'ночи', 'ночей')).toBe('5 ночей');
  });

  // 11
  test('money shows the amount with the tenge sign', () => {
    const text = money('15000', 'KZT');
    expect(text).toMatch(/15\s?000/);
    expect(text).toContain('₸');
  });

  // 12
  test('dateLabel writes a Russian date with or without the year', () => {
    expect(dateLabel('2030-01-10')).toBe('10 января');
    expect(dateLabel('2030-01-10', true)).toContain('2030');
  });
});
