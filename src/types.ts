/** An inbound message, normalized across providers. */
export interface Inbound {
  /** WhatsApp message ID (used for de-duplication and read receipts). */
  id: string;
  /** Sender in wa_id format, e.g. 15551234567. */
  from: string;
  /** WhatsApp profile name. Set by the sender: untrusted. */
  name?: string;
  /** Message text, or a short description for media. */
  text: string;
  timestamp: number;
}

/** "Echo": the owner replied by hand from the WhatsApp Business app (Coexistence). */
export interface Echo {
  to: string;
  text: string;
  timestamp: number;
}

export interface WebhookResult {
  response: { status: number; body: string; headers?: Record<string, string> };
  messages: Inbound[];
  echoes: Echo[];
}

export interface IncomingRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string | undefined>;
  rawBody: Buffer;
}

/** A provider knows how to receive webhooks and send messages. Adding one = implementing this. */
export interface Provider {
  readonly name: string;
  handleWebhook(req: IncomingRequest): Promise<WebhookResult>;
  sendText(to: string, text: string): Promise<{ id?: string }>;
  markRead?(messageId: string): Promise<void>;
}

export interface Product {
  id: string;
  name: string;
  unit?: string;
  price: number | null;
  available: boolean;
  notes?: string;
}

export interface Order {
  id: string;
  created_at: string;
  phone: string;
  customer: string;
  items: { product: string; quantity: number }[];
  fulfillment: string;
  address?: string;
  due?: string;
  total?: number | null;
  notes?: string;
  status: string;
}

/** Where the catalog and orders live. */
export interface Store {
  readonly name: string;
  catalog(): Promise<Product[]>;
  createOrder(o: Order): Promise<void>;
  orders(): Promise<Order[]>;
}
