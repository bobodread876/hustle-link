import { describe, it, expect } from 'vitest';

import { parseOrder } from './parse.js';

describe('parseOrder', () => {
  it('parses qty + item + total price', () => {
    const o = parseOrder('2 jerk chicken meal, total $2400');
    expect(o.items).toEqual([{ qty: 2, name: 'jerk chicken meal' }]);
    expect(o.total).toBe(2400);
    expect(o.currency).toBe('JMD');
    expect(o.confidence).toBe('high');
  });

  it('parses "each" pricing across items', () => {
    const o = parseOrder('3 box food $800 each');
    expect(o.items).toEqual([
      { qty: 3, name: 'box food', unitPrice: 800 },
    ]);
    expect(o.total).toBe(2400);
  });

  it('parses word quantities', () => {
    const o = parseOrder('two festival and one soup, $500');
    expect(o.items).toEqual([
      { qty: 2, name: 'festival' },
      { qty: 1, name: 'soup' },
    ]);
  });

  it('detects USD', () => {
    const o = parseOrder('1 day tour US$50');
    expect(o.currency).toBe('USD');
    expect(o.total).toBe(50);
  });

  it('extracts delivery location', () => {
    const o = parseOrder('2 curry goat lunch $1500, deliver to Half Way Tree');
    expect(o.deliverTo).toBe('Half Way Tree');
  });

  it('extracts buyer name and phone', () => {
    const o = parseOrder(
      '1 escovitch fish meal $1200, name Andre, 876-555-1234',
    );
    expect(o.buyerName).toBe('Andre');
    expect(o.buyerPhone).toContain('555');
  });

  it('marks priceless orders medium confidence', () => {
    const o = parseOrder('2 jerk pork lunch please');
    expect(o.total).toBeUndefined();
    expect(o.confidence).toBe('medium');
  });

  it('marks unparseable messages low confidence', () => {
    const o = parseOrder('yo you open today?');
    expect(o.items).toHaveLength(0);
    expect(o.confidence).toBe('low');
  });

  it('handles comma thousands in prices', () => {
    const o = parseOrder('1 whole roast fish J$3,500');
    expect(o.total).toBe(3500);
    expect(o.currency).toBe('JMD');
  });
});
