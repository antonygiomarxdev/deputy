import { expect, test } from "bun:test";
import { ORDER_FIELDS } from "../../../src/drafts/domain/order-fields";

// Written by hand from SPEC-02-owners-go.md (the list Orders accepts, Orders ADR-008). Change both together, on purpose.
test("ORDER_FIELDS is exactly the fields Orders accepts, in the spec's order", () => {
  expect([...ORDER_FIELDS]).toEqual(["status", "customer_name", "fulfillment", "address", "wanted_date", "wanted_time", "notes", "items"]);
});
