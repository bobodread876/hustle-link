# Product Roadmap

From working prototype to something real vendors use daily, ordered by
leverage.

## 1. Close the payment loop: LUD-21 `verify` on Flash

This is the biggest unlock, and it's a small change in Flash's LNURL
endpoint. Today the flow has a manual hole: the vendor notices the Flash
push notification and replies "paid". With
[LUD-21](https://github.com/lnurl/luds/blob/luds/21.md) the agent polls the
verify URL and announces **"⚡ Paid: 24,608 sats received"** in the chat
automatically. That is when the product starts to feel magical instead of
merely helpful.

It also benefits every app building on Flash lightning addresses.

## 2. USDT settlement option

Flash v0.6.0 shipped USDT support. The #1 objection from a fee-sensitive
vendor is volatility, and "get paid over Lightning, hold US dollars" answers it.
Design the option in early: the vendor chooses BTC or USD settlement at
onboarding.

## 3. Menu memory

The "no price guessing" rule is right, but the vendor then has to quote every
order. The agent should learn prices from confirmed orders into group
memory. After a few "jerk chicken meal = $1,200" confirmations, it quotes
automatically and the vendor only intervenes on changes.

## 4. Voice notes

Caribbean WhatsApp commerce runs on voice notes as much as text. NanoClaw
already has a whisper-transcription skill. Wiring it in makes
"customer sends voice note → agent parses order" work.

## 5. Day sheet

`skill/SKILL.md` sketches "close off", which isn't built yet: a persistent order
log per group, daily summary (orders taken, paid, unpaid, total sats + JMD
equivalent). Informal vendors have never had bookkeeping. A free day sheet gives them
a reason to stay even when Lightning volume is thin, and it is the data
layer any future fee model needs.

## 6. QR codes for in-person sales

A market-stall customer standing in front of the vendor shouldn't
copy-paste a BOLT11. Agent sends the invoice as a QR image (NanoClaw can
send images already). This is a small change with high impact for the
stall/event use case.

## 7. Run the pilot

Everything above is a hypothesis until 3–5 Island Bitcoin vendors use it for
two weeks:

- Burner number + NanoClaw instance with the skill installed in
  the container (currently a draft, not wired in)
- Onboard vendors as shape 1 or 2 (see [DEPLOYMENT.md](DEPLOYMENT.md))
- Self-serve onboarding: vendor messages the number, agent asks for their
  Flash username, sends a 1-sat test invoice to confirm. There is no dashboard.
- Measure: orders placed, invoices paid, parse failures, where vendors get
  confused

## Smaller but real

- **Invoice expiry handling**: the state machine has `expired` but nothing
  drives it; the agent should detect expiry and reissue on request
- **Friendly in-chat errors**: when LNURL or the price API is down, say so
  plainly instead of failing silently
- **Live demo number on the landing page**: let a curious visitor order a
  fictional box food and watch the flow

## Suggested sequence

1. LUD-21 on Flash (closes the loop)
2. Wire the skill into a real NanoClaw container; run one real order
   end-to-end in a test group against a real Flash wallet

Those two make it demo-able to a real vendor, which gates everything else.
