import { Currency, OrderItem, ParsedOrder } from './types.js';

const QTY_WORDS: Record<string, number> = {
  a: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

// "$800", "J$1,500", "US$10", "800 JMD", "10 usd"
const PRICE_RE =
  /(?:(us|j|jmd|usd)?\s*\$\s*([\d,]+(?:\.\d{1,2})?))|(?:([\d,]+(?:\.\d{1,2})?)\s*(jmd|usd|jamaican|us)\b)/i;

// "2 jerk chicken", "3x festival", "two box food"
const ITEM_RE =
  /(?:^|[,;\n]|\band\b|\bplus\b|\+)\s*(\d+|a|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:x\s*)?([a-z][a-z\s'&-]{2,40}?)(?=\s*(?:[,;\n@$]|\band\b|\bplus\b|\+|\bfor\b|\bat\b|\d|$))/gi;

const DELIVER_RE =
  /(?:deliver(?:y)?\s*(?:to|at|:)?|drop\s*(?:off|it)?\s*(?:to|at|:)?|send\s+(?:it\s+)?to)\s+([^,;\n.]{3,60})/i;

const PICKUP_RE = /\bpick\s*up\b\s*(?:at|by|around|:)?\s*([^,;\n.]{0,30})/i;

const PHONE_RE = /(?:\+?1[\s-]?)?(?:\(?876\)?[\s-]?)?\d{3}[\s-]?\d{4}\b/;

const NAME_RE = /\b(?:name(?:\s+is)?|for|it's|its)\s*:?\s+([A-Z][a-z]{2,15})\b/;

const TOTAL_RE = /\btotal\b[^\d$]*(?:(?:us|j|jmd|usd)?\s*\$\s*)?([\d,]+(?:\.\d{1,2})?)/i;

/** Words that indicate a fragment is not a food/product item. */
const NOISE_WORDS =
  /\b(deliver|delivery|drop|pickup|pick|total|name|phone|address|please|pls|thanks|thank|asap|today|tomorrow|morning|evening|order)\b/i;

function parseAmount(s: string): number {
  return parseFloat(s.replace(/,/g, ''));
}

function detectCurrency(text: string, defaultCurrency: Currency): Currency {
  if (/\bus\s*\$|\busd\b/i.test(text)) return 'USD';
  if (/\bj\s*\$|\bjmd\b|jamaican/i.test(text)) return 'JMD';
  if (/\bsats?\b/i.test(text)) return 'SATS';
  return defaultCurrency;
}

function extractItems(text: string): OrderItem[] {
  const items: OrderItem[] = [];
  for (const m of text.matchAll(ITEM_RE)) {
    const qtyToken = m[1].toLowerCase();
    const qty = QTY_WORDS[qtyToken] ?? parseInt(qtyToken, 10);
    let name = m[2].trim().replace(/\s+/g, ' ');
    // Trim trailing pleasantries/instructions off the item name.
    let words = name.split(' ');
    while (words.length && NOISE_WORDS.test(words[words.length - 1])) {
      words.pop();
    }
    name = words.join(' ');
    if (!qty || qty > 100 || name.length < 3) continue;
    if (NOISE_WORDS.test(name)) continue;
    items.push({ qty, name });
  }
  return items;
}

/**
 * Heuristic WhatsApp order parser.
 *
 * This is the deterministic fallback / CLI demo path. In an agent
 * deployment (NanoClaw), the LLM produces the ParsedOrder directly and
 * this module only validates it.
 */
export function parseOrder(
  raw: string,
  opts: { defaultCurrency?: Currency } = {},
): ParsedOrder {
  const text = raw.trim();
  const currency = detectCurrency(text, opts.defaultCurrency ?? 'JMD');
  const items = extractItems(text);

  // Per-item price: "$800 each" applies to items; a lone price with a
  // single item is treated as that item's unit price.
  let total: number | undefined;
  const totalMatch = text.match(TOTAL_RE);
  const priceMatch = text.match(PRICE_RE);
  const priceValue = priceMatch
    ? parseAmount(priceMatch[2] ?? priceMatch[3])
    : undefined;

  if (totalMatch) {
    total = parseAmount(totalMatch[1]);
  } else if (priceValue !== undefined) {
    const isEach = /\beach\b|\bper\b|\ba\s?piece\b/i.test(text);
    const qtySum = items.reduce((s, i) => s + i.qty, 0);
    if (isEach && qtySum > 0) {
      for (const item of items) item.unitPrice = priceValue;
      total = priceValue * qtySum;
    } else if (items.length === 1) {
      // Ambiguous: single item + single price — read it as the line total.
      total = priceValue;
    } else {
      total = priceValue;
    }
  }

  const deliverMatch = text.match(DELIVER_RE);
  const pickupMatch = text.match(PICKUP_RE);
  const phoneMatch = text.match(PHONE_RE);
  const nameMatch = text.match(NAME_RE);

  let confidence: ParsedOrder['confidence'] = 'high';
  if (items.length === 0) confidence = 'low';
  else if (total === undefined) confidence = 'medium';

  return {
    items,
    currency,
    total,
    deliverTo: deliverMatch
      ? deliverMatch[1].trim()
      : pickupMatch
        ? `pickup ${pickupMatch[1].trim()}`.trim()
        : undefined,
    buyerName: nameMatch?.[1],
    buyerPhone: phoneMatch?.[0],
    confidence,
    raw,
  };
}
