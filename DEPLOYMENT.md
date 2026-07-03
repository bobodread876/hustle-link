# Deployment: how the WhatsApp agent actually connects

The hustle-link library is transport-agnostic — it takes order text in and
returns a Lightning invoice. This doc covers the part around it: how an agent
gets the messages, and how vendors onboard.

## Transport: no Meta Cloud API required

The intended runtime is [NanoClaw](https://github.com/qwibitai/nanoclaw),
whose WhatsApp channel connects via **Baileys** — the WhatsApp Web
multi-device protocol. The agent is a regular WhatsApp account paired by QR
code, exactly like linking WhatsApp Web on a laptop. It sits in chats like a
person would.

| | Baileys (NanoClaw) | Meta Cloud API |
|---|---|---|
| Approval | None — pair a number by QR | Meta business verification |
| Cost | Free | Per-conversation fees |
| Group chats | ✅ Yes | ❌ 1:1 threads only |
| Status | Unofficial (ToS gray area, ban risk) | Official, sanctioned |
| Crypto policy risk | N/A | Meta commerce policy is hostile to crypto-adjacent services |

**Pilot on Baileys** with a dedicated agent number (never a vendor's real
number — accept the ban risk on a burner). Revisit the Cloud API question
only after the pilot proves vendors want this; note that losing group support
changes the product shape, and Meta policy approval for a Lightning-payments
bot is itself an open risk.

One NanoClaw instance = one agent WhatsApp number = **many vendors**. Each
registered group gets isolated config and memory; the group's `CLAUDE.md`
holds that vendor's `vendor_lightning_address` (see
[`skill/SKILL.md`](skill/SKILL.md)).

## Vendor onboarding shapes

Vendors don't all work the same way, so there are three supported shapes —
per vendor, pick whichever matches how they already take orders.

### 1. Agent joins the vendor's existing customer group

Many vendors already run their business through a WhatsApp group: customers
post orders, vendor confirms. The vendor adds the agent's number to that
group and registers it. Customers change nothing. The agent watches for
order-shaped messages and replies with the invoice in-thread.

**Best for:** vendors with an existing order/community group. Lowest friction.

### 2. Private "order desk" group (vendor + agent only)

If orders arrive as 1:1 DMs to the vendor's personal number, the agent
cannot see them — those chats belong to the vendor's account. Instead the
vendor creates a two-member group with the agent and forwards orders into
it:

```
customer DM → vendor forwards to order desk → agent replies with
parsed order + invoice → vendor forwards invoice to customer
```

One extra step per order, but the vendor keeps full control of the customer
relationship, and customers' behavior doesn't change at all.

**Best for:** DM-based vendors; vendors who want to review before invoicing.

### 3. Dedicated storefront number

Customers message the agent's number directly and the agent handles the
whole conversation 1:1. Cleanest customer experience, but one number serves
one storefront personality, and it asks customers to message a new number —
which cuts against the "your customers are already in the chat" pitch.

**Best for:** a single vendor wanting a hands-off ordering line.

### ❌ Not supported: pairing to the vendor's own account

Technically possible (QR-pair Baileys to the vendor's real WhatsApp so the
agent sees their DMs and replies as them) — ruled out deliberately:

- Ban risk from unofficial protocol use would land on the vendor's actual
  business number.
- An agent sending payment requests *as the vendor* is a trust and
  blast-radius problem.

## Pilot playbook

1. Stand up NanoClaw with a dedicated agent number (burner SIM / eSIM).
2. Install the [`hustle-link` skill](skill/SKILL.md) in the container.
3. Onboard each vendor as shape 1 (has an order group) or shape 2 (DM-based):
   add the number, agent asks for their Flash username, saves
   `vendor_lightning_address` to the group's `CLAUDE.md`. Done.
4. Payment confirmation is manual for now (vendor sees the Flash push
   notification and replies "paid") — Flash's LNURL endpoint doesn't expose
   LUD-21 verify yet. See [README](README.md#findings-from-the-live-spike-2026-07-03).
