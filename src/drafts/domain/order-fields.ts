/** The fields Orders accepts in a change (Orders ADR-008). Keys outside this list are refused, so a key can never carry customer text into the log. */
export const ORDER_FIELDS = ["status", "customer_name", "fulfillment", "address", "wanted_date", "wanted_time", "notes", "items"] as const;
export type OrderField = (typeof ORDER_FIELDS)[number];
