import { z } from "zod";

// Field paths: SPEC-01 Context table (L8). Unknown extra keys are dropped; `_gate` keys in fixtures are ignored.

const kapsoExtension = z.object({
  direction: z.enum(["inbound", "outbound"]),
  origin: z.string().nullable().optional(),
  transcript: z.object({ text: z.string() }).nullable().optional(),
  whatsapp_conversation_id: z.string().nullable().optional(),
});

export const messageSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().regex(/^\d+$/),
  type: z.string().optional(),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  text: z.object({ body: z.string() }).nullable().optional(),
  kapso: kapsoExtension,
});

export const conversationSchema = z.object({
  id: z.string().min(1),
  phone_number: z.string().nullable().optional(),
  last_active_at: z.string(),
});

const paging = z
  .object({
    cursors: z.object({ after: z.string().nullable().optional() }).optional(),
    next: z.string().nullable().optional(),
  })
  .optional();

export const messagePageSchema = z.object({ data: z.array(messageSchema), paging });
export const conversationPageSchema = z.object({ data: z.array(conversationSchema), paging });

export const phoneNumberSchema = z.object({
  data: z.object({ display_phone_number: z.string().nullable().optional() }),
});

export const sendResponseSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).min(1),
});

const liveItem = z.object({
  message: messageSchema,
  conversation: z.object({ id: z.string().min(1) }).optional(),
});

export const liveDeliverySchema = z.union([
  liveItem.transform((i) => [i]),
  z.object({ batch: z.literal(true), data: z.array(liveItem) }).transform((b) => b.data),
]);
