import { Currency } from './types.js';
import { FetchLike } from './lnaddress.js';

export interface PriceSource {
  /** BTC price in the given fiat currency. */
  btcPriceIn(currency: 'JMD' | 'USD'): Promise<number>;
}

/**
 * Free, keyless default: BTC/USD from CoinGecko, then USD→JMD via
 * open.er-api.com (CoinGecko doesn't quote JMD directly).
 * Swap for Flash's price-server feed in production.
 */
export class CoinGeckoPriceSource implements PriceSource {
  constructor(private fetchFn: FetchLike = fetch) {}

  private async btcUsd(): Promise<number> {
    const url =
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
    const res = await this.fetchFn(url);
    if (!res.ok) throw new Error(`Price lookup failed (HTTP ${res.status})`);
    const data = (await res.json()) as { bitcoin?: { usd?: number } };
    const price = data.bitcoin?.usd;
    if (!price || price <= 0) throw new Error('No BTC/USD price in response');
    return price;
  }

  private async usdRate(currency: string): Promise<number> {
    const res = await this.fetchFn('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error(`FX lookup failed (HTTP ${res.status})`);
    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    const rate = data.rates?.[currency];
    if (data.result !== 'success' || !rate || rate <= 0)
      throw new Error(`No USD/${currency} rate in response`);
    return rate;
  }

  async btcPriceIn(currency: 'JMD' | 'USD'): Promise<number> {
    const usd = await this.btcUsd();
    if (currency === 'USD') return usd;
    return usd * (await this.usdRate(currency));
  }
}

const SATS_PER_BTC = 100_000_000;

/** Convert a fiat order total to whole sats (rounded up — vendor never loses). */
export async function toSats(
  amount: number,
  currency: Currency,
  source: PriceSource,
): Promise<number> {
  if (currency === 'SATS') return Math.ceil(amount);
  const price = await source.btcPriceIn(currency);
  return Math.ceil((amount / price) * SATS_PER_BTC);
}
