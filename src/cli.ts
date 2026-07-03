#!/usr/bin/env node
import { parseOrder } from './parse.js';
import { createOrder, checkPaid } from './order.js';
import { CoinGeckoPriceSource } from './price.js';
import { verifyPayment } from './lnaddress.js';
import { Currency, Order } from './types.js';

const USAGE = `hustle — WhatsApp orders → Lightning invoices

Usage:
  hustle parse "<message>"                     Parse an order message (offline)
  hustle order --vendor <ln-address> "<msg>"   Parse, price, and invoice an order
  hustle check <verify-url>                    Check whether an invoice settled
  hustle rate [JMD|USD]                        Current BTC price

Options:
  --vendor <address>    Lightning address invoices pay to (e.g. cookshop@flashapp.me)
  --currency <JMD|USD>  Default currency when the message doesn't say (default JMD)
`;

function printOrder(order: Order): void {
  const p = order.parsed;
  console.log(`\nOrder ${order.id}  [${order.status.toUpperCase()}]`);
  console.log(`  vendor:   ${order.vendor}`);
  for (const item of p.items) {
    const price = item.unitPrice ? ` @ ${item.unitPrice}` : '';
    console.log(`  item:     ${item.qty}x ${item.name}${price}`);
  }
  if (p.total !== undefined)
    console.log(`  total:    ${p.total} ${p.currency}`);
  if (order.sats) console.log(`  sats:     ${order.sats}`);
  if (p.deliverTo) console.log(`  deliver:  ${p.deliverTo}`);
  if (p.buyerName) console.log(`  buyer:    ${p.buyerName}`);
  if (p.buyerPhone) console.log(`  phone:    ${p.buyerPhone}`);
  console.log(`  parse confidence: ${p.confidence}`);
  if (order.invoice) console.log(`\n  invoice:\n  ${order.invoice}`);
  if (order.verifyUrl) console.log(`\n  verify: ${order.verifyUrl}`);
  if (order.status === 'received') {
    console.log(
      `\n  No price stated — vendor quotes a total, then invoice is generated.`,
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0];

  const flag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const positional = args
    .slice(1)
    .filter((a, i, arr) => !a.startsWith('--') && arr[i - 1]?.startsWith('--') !== true);

  switch (cmd) {
    case 'parse': {
      const msg = positional[0];
      if (!msg) throw new Error('usage: hustle parse "<message>"');
      const parsed = parseOrder(msg, {
        defaultCurrency: (flag('currency') as Currency) ?? 'JMD',
      });
      console.log(JSON.stringify(parsed, null, 2));
      break;
    }
    case 'order': {
      const vendor = flag('vendor');
      const msg = positional[0];
      if (!vendor || !msg)
        throw new Error('usage: hustle order --vendor <ln-address> "<msg>"');
      const order = await createOrder(vendor, msg, {
        defaultCurrency: (flag('currency') as Currency) ?? 'JMD',
        priceSource: new CoinGeckoPriceSource(),
      });
      printOrder(order);
      break;
    }
    case 'check': {
      const url = positional[0];
      if (!url) throw new Error('usage: hustle check <verify-url>');
      const result = await verifyPayment(url);
      console.log(result.settled ? 'PAID ✓' : 'unpaid');
      break;
    }
    case 'rate': {
      const currency = (positional[0]?.toUpperCase() ?? 'JMD') as 'JMD' | 'USD';
      const price = await new CoinGeckoPriceSource().btcPriceIn(currency);
      console.log(`1 BTC = ${price.toLocaleString()} ${currency}`);
      break;
    }
    default:
      console.log(USAGE);
      process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exit(1);
});
