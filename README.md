# Hustle Link

**Turn WhatsApp orders into Lightning payments for Caribbean hustlers.**

Caribbean informal commerce runs on WhatsApp — cook shops, craft vendors, and
market stalls take orders in chat and collect cash on delivery. Hustle Link
bridges the gap: it reads a WhatsApp order message, structures it, converts
the total to sats, and generates a Lightning invoice that pays **directly into
the vendor's Flash wallet**. No app for the vendor to learn.

Prototype for the venture assessed at [patoo.ai/ideas](https://patoo.ai/ideas).

## How it works

```
"2 jerk chicken meal, total $2400, deliver to Half Way Tree, name Andre"
        │
        ▼  parse.ts     — items, total, currency, buyer, delivery
        ▼  price.ts     — 2400 JMD → 24,608 sats (BTC/USD × USD/JMD)
        ▼  lnaddress.ts — LNURL-pay against vendor@flashapp.me
        │
        ▼
lnbc246080n1p4y0hpt...   ← buyer pays this; sats land in the vendor's Flash wallet
```

The key design decision: **no custody, no API keys**. Invoices are generated
through the vendor's existing lightning address (every Flash username has
one), so the prototype never touches funds and needs zero credentials.

## Try it

```bash
npm install && npm run build

# Offline: parse an order message
npx tsx src/cli.ts parse "3 box food \$800 each, drop off at Papine"

# Live: generate a real invoice for a Flash user
npx tsx src/cli.ts order --vendor <username>@flashapp.me \
  "2 jerk chicken meal, total \$2400, name Andre"

# BTC price in JMD
npx tsx src/cli.ts rate JMD
```

## Order lifecycle

| Status     | Meaning                                                      |
| ---------- | ------------------------------------------------------------ |
| `received` | Parsed but no price stated — vendor quotes, then `quoteOrder` |
| `invoiced` | Lightning invoice generated and sent to buyer                 |
| `paid`     | Settlement confirmed (LUD-21 verify)                          |

## Findings from the live spike (2026-07-03)

- Flash lightning addresses resolve via standard LNURL-pay at
  `flashapp.me/.well-known/lnurlp/<user>` (backed by IBEX). `commentAllowed:
  140` means the order memo (`Order for Andre: 2x jerk chicken meal`) shows up
  with the payment.
- **Flash/IBEX does not return a LUD-21 `verify` URL**, so automated payment
  confirmation isn't possible from the outside yet. Options: (a) add LUD-21 to
  Flash's LNURL responses — small backend change, big enabler; (b) vendor
  confirms manually from their Flash push notification; (c) poll the Flash
  GraphQL API with vendor auth (requires credentials, breaks the zero-custody
  model).
- CoinGecko doesn't quote BTC/JMD; the default price source composes BTC/USD
  with USD/JMD from open.er-api.com. Production should use Flash's own
  price server (same feed the app shows vendors).

## Production path (NanoClaw deployment)

The heuristic parser exists so the CLI works standalone. In deployment, this
runs as an agent skill inside [NanoClaw](https://github.com/qwibitai/nanoclaw):
the vendor adds the agent to their WhatsApp business group, the LLM does the
parsing (handling patois, voice notes via transcription, and back-and-forth
clarification), and this library handles the money path. See
[`skill/SKILL.md`](skill/SKILL.md).

## Non-goals (for now)

- Custody, escrow, or refunds — buyer pays vendor directly
- Fiat settlement — vendors keep sats in Flash (cash-out is Flash's job)
- Catalog/menu management — the message is the interface
