import { describe, it, expect, vi } from 'vitest';

import {
  requestInvoice,
  resolveLnAddress,
  verifyPayment,
  LnAddressError,
} from './lnaddress.js';

function mockFetch(responses: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const key = Object.keys(responses).find((k) => url.startsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => responses[key] };
  });
}

const PAY_PARAMS = {
  callback: 'https://ibex.flashapp.me/pay/lnurl/cookshop',
  minSendable: 1000,
  maxSendable: 150_000_000_000,
  metadata: '[["text/plain","Paying to LnUrl Pay"]]',
  commentAllowed: 140,
  tag: 'payRequest',
};

describe('resolveLnAddress', () => {
  it('resolves a flash lightning address', async () => {
    const fetchFn = mockFetch({
      'https://flashapp.me/.well-known/lnurlp/cookshop': PAY_PARAMS,
    });
    const params = await resolveLnAddress('cookshop@flashapp.me', fetchFn);
    expect(params.callback).toContain('ibex.flashapp.me');
  });

  it('rejects malformed addresses', async () => {
    await expect(resolveLnAddress('not-an-address')).rejects.toThrow(
      LnAddressError,
    );
  });

  it('surfaces LNURL error responses', async () => {
    const fetchFn = mockFetch({
      'https://flashapp.me/.well-known/lnurlp/ghost': {
        status: 'ERROR',
        reason: 'User not found',
      },
    });
    await expect(
      resolveLnAddress('ghost@flashapp.me', fetchFn),
    ).rejects.toThrow(/User not found/);
  });
});

describe('requestInvoice', () => {
  it('requests an invoice with amount and comment', async () => {
    const fetchFn = mockFetch({
      'https://flashapp.me/.well-known/lnurlp/cookshop': PAY_PARAMS,
      'https://ibex.flashapp.me/pay/lnurl/cookshop': {
        pr: 'lnbc21u1p...',
        verify: 'https://ibex.flashapp.me/verify/abc',
      },
    });
    const result = await requestInvoice('cookshop@flashapp.me', 2100, {
      comment: 'Order: 2x jerk chicken meal',
      fetchFn,
    });
    expect(result.pr).toBe('lnbc21u1p...');
    expect(result.verify).toContain('/verify/');

    const callbackCall = fetchFn.mock.calls.find(([u]) =>
      u.includes('/pay/lnurl/cookshop?'),
    );
    expect(callbackCall![0]).toContain('amount=2100000');
    expect(callbackCall![0]).toContain('comment=');
  });

  it('rejects amounts outside sendable range', async () => {
    const fetchFn = mockFetch({
      'https://flashapp.me/.well-known/lnurlp/cookshop': {
        ...PAY_PARAMS,
        minSendable: 1_000_000,
      },
    });
    await expect(
      requestInvoice('cookshop@flashapp.me', 1, { fetchFn }),
    ).rejects.toThrow(/outside allowed range/);
  });

  it('truncates comments to commentAllowed', async () => {
    const fetchFn = mockFetch({
      'https://flashapp.me/.well-known/lnurlp/cookshop': {
        ...PAY_PARAMS,
        commentAllowed: 10,
      },
      'https://ibex.flashapp.me/pay/lnurl/cookshop': { pr: 'lnbc1...' },
    });
    await requestInvoice('cookshop@flashapp.me', 100, {
      comment: 'a very long order description that exceeds the cap',
      fetchFn,
    });
    const callbackCall = fetchFn.mock.calls.find(([u]) =>
      u.includes('/pay/lnurl/cookshop?'),
    );
    const comment = new URL(callbackCall![0]).searchParams.get('comment');
    expect(comment).toHaveLength(10);
  });
});

describe('verifyPayment', () => {
  it('reports settled invoices', async () => {
    const fetchFn = mockFetch({
      'https://ibex.flashapp.me/verify/abc': {
        status: 'OK',
        settled: true,
        preimage: 'deadbeef',
      },
    });
    const result = await verifyPayment(
      'https://ibex.flashapp.me/verify/abc',
      fetchFn,
    );
    expect(result.settled).toBe(true);
  });

  it('reports unsettled invoices', async () => {
    const fetchFn = mockFetch({
      'https://ibex.flashapp.me/verify/abc': {
        status: 'OK',
        settled: false,
        preimage: null,
      },
    });
    const result = await verifyPayment(
      'https://ibex.flashapp.me/verify/abc',
      fetchFn,
    );
    expect(result.settled).toBe(false);
  });
});
