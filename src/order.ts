import { randomUUID } from 'node:crypto';

import { requestInvoice, verifyPayment, FetchLike } from './lnaddress.js';
import { parseOrder } from './parse.js';
import { PriceSource, toSats } from './price.js';
import { Currency, Order } from './types.js';

export interface CreateOrderOpts {
  defaultCurrency?: Currency;
  priceSource: PriceSource;
  fetchFn?: FetchLike;
}

/** Human-readable memo attached to the invoice (vendor sees it in Flash). */
export function orderMemo(order: Order): string {
  const items = order.parsed.items
    .map((i) => `${i.qty}x ${i.name}`)
    .join(', ');
  const who = order.parsed.buyerName ? ` for ${order.parsed.buyerName}` : '';
  return `Order${who}: ${items}`.slice(0, 140);
}

/**
 * Full pipeline: raw WhatsApp message → parsed order → sats → invoice.
 *
 * Orders without a stated price stop at `received` — the vendor quotes
 * a price, then the invoice is generated with an explicit total.
 */
export async function createOrder(
  vendor: string,
  message: string,
  opts: CreateOrderOpts,
): Promise<Order> {
  const parsed = parseOrder(message, {
    defaultCurrency: opts.defaultCurrency,
  });
  const now = new Date().toISOString();
  const order: Order = {
    id: randomUUID().slice(0, 8),
    vendor,
    parsed,
    status: 'received',
    createdAt: now,
    updatedAt: now,
  };

  if (parsed.total === undefined) return order;

  order.sats = await toSats(parsed.total, parsed.currency, opts.priceSource);
  const { pr, verify } = await requestInvoice(vendor, order.sats, {
    comment: orderMemo(order),
    fetchFn: opts.fetchFn,
  });
  order.invoice = pr;
  order.verifyUrl = verify;
  order.status = 'invoiced';
  order.updatedAt = new Date().toISOString();
  return order;
}

/** Re-invoice a `received` order once the vendor supplies a total. */
export async function quoteOrder(
  order: Order,
  total: number,
  opts: CreateOrderOpts,
): Promise<Order> {
  order.parsed.total = total;
  order.sats = await toSats(total, order.parsed.currency, opts.priceSource);
  const { pr, verify } = await requestInvoice(order.vendor, order.sats, {
    comment: orderMemo(order),
    fetchFn: opts.fetchFn,
  });
  order.invoice = pr;
  order.verifyUrl = verify;
  order.status = 'invoiced';
  order.updatedAt = new Date().toISOString();
  return order;
}

/** Check settlement via LUD-21 and update status. */
export async function checkPaid(
  order: Order,
  fetchFn?: FetchLike,
): Promise<Order> {
  if (!order.verifyUrl) return order;
  const { settled } = await verifyPayment(order.verifyUrl, fetchFn ?? fetch);
  if (settled && order.status !== 'paid') {
    order.status = 'paid';
    order.updatedAt = new Date().toISOString();
  }
  return order;
}
