import { describe, it, expect, vi } from 'vitest';

import { createOrder, checkPaid, orderMemo, quoteOrder } from './order.js';
import { PriceSource } from './price.js';

const fixedPrice: PriceSource = {
  btcPriceIn: vi.fn(async () => 16_000_000), // 1 BTC = 16M JMD
};

function mockFetch(responses: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const key = Object.keys(responses).find((k) => url.startsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => responses[key] };
  });
}

const LNURL_RESPONSES = {
  'https://flashapp.me/.well-known/lnurlp/cookshop': {
    callback: 'https://ibex.flashapp.me/pay/lnurl/cookshop',
    minSendable: 1000,
    maxSendable: 150_000_000_000,
    metadata: '[]',
    commentAllowed: 140,
    tag: 'payRequest',
  },
  'https://ibex.flashapp.me/pay/lnurl/cookshop': {
    pr: 'lnbc15u1pmock',
    verify: 'https://ibex.flashapp.me/verify/xyz',
  },
};

describe('createOrder', () => {
  it('runs the full pipeline: message → sats → invoice', async () => {
    const order = await createOrder(
      'cookshop@flashapp.me',
      '2 jerk chicken meal, total $2400, deliver to Half Way Tree',
      { priceSource: fixedPrice, fetchFn: mockFetch(LNURL_RESPONSES) },
    );
    expect(order.status).toBe('invoiced');
    // 2400 JMD at 16M JMD/BTC = 15000 sats
    expect(order.sats).toBe(15000);
    expect(order.invoice).toBe('lnbc15u1pmock');
    expect(order.verifyUrl).toContain('/verify/');
  });

  it('stops at received when no price is stated', async () => {
    const fetchFn = mockFetch(LNURL_RESPONSES);
    const order = await createOrder(
      'cookshop@flashapp.me',
      '2 jerk chicken meal please',
      { priceSource: fixedPrice, fetchFn },
    );
    expect(order.status).toBe('received');
    expect(order.invoice).toBeUndefined();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('quoteOrder invoices a received order once priced', async () => {
    const order = await createOrder(
      'cookshop@flashapp.me',
      '2 jerk chicken meal please',
      { priceSource: fixedPrice, fetchFn: mockFetch(LNURL_RESPONSES) },
    );
    const quoted = await quoteOrder(order, 2400, {
      priceSource: fixedPrice,
      fetchFn: mockFetch(LNURL_RESPONSES),
    });
    expect(quoted.status).toBe('invoiced');
    expect(quoted.sats).toBe(15000);
  });
});

describe('checkPaid', () => {
  it('marks order paid when invoice settles', async () => {
    const order = await createOrder(
      'cookshop@flashapp.me',
      '1 soup $500',
      { priceSource: fixedPrice, fetchFn: mockFetch(LNURL_RESPONSES) },
    );
    const paid = await checkPaid(
      order,
      mockFetch({
        'https://ibex.flashapp.me/verify/xyz': {
          status: 'OK',
          settled: true,
        },
      }),
    );
    expect(paid.status).toBe('paid');
  });
});

describe('orderMemo', () => {
  it('builds a vendor-readable memo', async () => {
    const order = await createOrder(
      'cookshop@flashapp.me',
      '2 jerk chicken meal, total $2400, name Andre',
      { priceSource: fixedPrice, fetchFn: mockFetch(LNURL_RESPONSES) },
    );
    expect(orderMemo(order)).toBe('Order for Andre: 2x jerk chicken meal');
  });
});
