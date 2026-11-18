import { expect, spyOn, test } from "bun:test";
import { InProcessEventBus } from "../../../src/adapters/events/in-process-event-bus";

test("handlers get the event in subscription order", () => {
  const bus = new InProcessEventBus<string>();
  const seen: string[] = [];
  bus.subscribe((e) => void seen.push(`1:${e}`));
  bus.subscribe((e) => void seen.push(`2:${e}`));
  bus.publish("x");
  expect(seen).toEqual(["1:x", "2:x"]);
});

test("a throwing and a rejecting handler are logged and do not stop delivery or publish", async () => {
  const log = spyOn(console, "error").mockImplementation(() => {});
  const bus = new InProcessEventBus<string>();
  const seen: string[] = [];
  bus.subscribe(() => {
    throw new Error("first");
  });
  bus.subscribe(async () => {
    throw new Error("second");
  });
  bus.subscribe((e) => void seen.push(e));
  expect(() => bus.publish("x")).not.toThrow();
  await new Promise((r) => setTimeout(r, 0));
  expect(seen).toEqual(["x"]);
  expect(log).toHaveBeenCalledTimes(2);
  log.mockRestore();
});

test("no handler: nothing happens", () => {
  expect(() => new InProcessEventBus<string>().publish("x")).not.toThrow();
});

test("an event published inside a handler is delivered after the outer handlers ran", () => {
  const bus = new InProcessEventBus<string>();
  const seen: string[] = [];
  bus.subscribe((e) => {
    seen.push(`a:${e}`);
    if (e === "outer") bus.publish("inner");
  });
  bus.subscribe((e) => void seen.push(`b:${e}`));
  bus.publish("outer");
  expect(seen).toEqual(["a:outer", "b:outer", "a:inner", "b:inner"]);
});
