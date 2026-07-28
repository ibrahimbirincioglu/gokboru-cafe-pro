import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";

export type LiveOrderEvent = {
  eventId: string;
  type: "ORDER_CREATED" | "ORDER_STATUS_CHANGED";
  orderId: string;
  occurredAt: string;
};

const globalRealtime = globalThis as typeof globalThis & {
  gokboruRealtimeBus?: EventEmitter;
};

export const realtimeBus =
  globalRealtime.gokboruRealtimeBus ?? new EventEmitter();

globalRealtime.gokboruRealtimeBus = realtimeBus;

realtimeBus.setMaxListeners(100);

export function publishOrderEvent(
  type: LiveOrderEvent["type"],
  orderId: string,
) {
  const event: LiveOrderEvent = {
    eventId: randomUUID(),
    type,
    orderId,
    occurredAt: new Date().toISOString(),
  };
  realtimeBus.emit("order-event", event);
  return event;
}
