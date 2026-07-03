export type Currency = 'JMD' | 'USD' | 'SATS';

export interface OrderItem {
  qty: number;
  name: string;
  /** Unit price in `currency` units, when stated in the message. */
  unitPrice?: number;
}

export interface ParsedOrder {
  items: OrderItem[];
  currency: Currency;
  /** Order total in `currency` units. Absent when no price was stated. */
  total?: number;
  deliverTo?: string;
  buyerName?: string;
  buyerPhone?: string;
  notes?: string;
  /** low = vendor should review before an invoice is sent. */
  confidence: 'high' | 'medium' | 'low';
  raw: string;
}

export type OrderStatus =
  | 'received' // parsed, no price yet — vendor must quote
  | 'invoiced' // Lightning invoice generated and sent to buyer
  | 'paid' // payment confirmed
  | 'expired'; // invoice expired unpaid

export interface Order {
  id: string;
  vendor: string; // lightning address the invoice pays to
  parsed: ParsedOrder;
  sats?: number;
  invoice?: string; // BOLT11 payment request
  verifyUrl?: string; // LUD-21 verify endpoint, when the wallet supports it
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}
