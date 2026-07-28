import type { IncomingMessage } from "node:http";
import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  isValidOrderTransition,
  nextOrderStatus,
  orderItemStatusFor,
  orderStatusTimestamp,
  ORDER_STATUS_SEQUENCE,
} from "../src/features/orders/status";
import {
  EventDeduplicator,
  reconnectDelay,
} from "../src/lib/realtime/dedupe";
import {
  extractOrderToken,
  isAllowedOrigin,
  isAdminSocketSessionValid,
  parseCookies,
  parseProtocols,
} from "../src/server/realtime-server";

describe("managed order status flow", () => {
  it("allows only the required forward sequence", () => {
    for (let index = 0; index < ORDER_STATUS_SEQUENCE.length - 1; index += 1) {
      const from = ORDER_STATUS_SEQUENCE[index]!;
      const to = ORDER_STATUS_SEQUENCE[index + 1]!;
      expect(nextOrderStatus(from)).toBe(to);
      expect(isValidOrderTransition(from, to)).toBe(true);
    }
    expect(nextOrderStatus("TAMAMLANDI")).toBeNull();
    expect(isValidOrderTransition("HAZIR", "ONAYLANDI")).toBe(false);
    expect(isValidOrderTransition("BEKLIYOR", "HAZIR")).toBe(false);
    expect(isValidOrderTransition("IPTAL", "ONAYLANDI")).toBe(false);
  });

  it("maps order status to item status and timestamps", () => {
    const now = new Date("2026-07-28T20:00:00Z");
    expect(orderItemStatusFor("TAMAMLANDI")).toBe("SERVIS_EDILDI");
    expect(orderStatusTimestamp("ONAYLANDI", now)).toEqual({
      acceptedAt: now,
    });
    expect(orderStatusTimestamp("HAZIRLANIYOR", now)).toEqual({
      preparingAt: now,
    });
    expect(orderStatusTimestamp("HAZIR", now)).toEqual({ readyAt: now });
    expect(orderStatusTimestamp("TAMAMLANDI", now)).toEqual({
      completedAt: now,
    });
  });
});

describe("realtime reliability", () => {
  it("drops duplicate events and bounds dedupe memory", () => {
    const dedupe = new EventDeduplicator(2);
    expect(dedupe.accept("event-1")).toBe(true);
    expect(dedupe.accept("event-1")).toBe(false);
    expect(dedupe.accept("event-2")).toBe(true);
    expect(dedupe.accept("event-3")).toBe(true);
    expect(dedupe.accept("event-1")).toBe(true);
  });

  it("uses capped exponential reconnect delays", () => {
    expect(reconnectDelay(0)).toBe(1_000);
    expect(reconnectDelay(4)).toBe(16_000);
    expect(reconnectDelay(10)).toBe(30_000);
  });
});

describe("WebSocket request security", () => {
  it("requires the configured same origin", () => {
    expect(
      isAllowedOrigin(
        "https://gokborucafe.com",
        "https://gokborucafe.com",
      ),
    ).toBe(true);
    expect(
      isAllowedOrigin(
        "https://attacker.example",
        "https://gokborucafe.com",
      ),
    ).toBe(false);
    expect(isAllowedOrigin(undefined, "https://gokborucafe.com")).toBe(false);
  });

  it("requires an active unexpired session with order permission", () => {
    const now = new Date("2026-07-28T20:00:00Z");
    const session = {
      revokedAt: null,
      expiresAt: new Date("2026-07-28T22:00:00Z"),
      idleExpiresAt: new Date("2026-07-28T20:30:00Z"),
      user: { isActive: true, role: UserRole.ADMIN },
    };
    expect(isAdminSocketSessionValid(session, now)).toBe(true);
    expect(
      isAdminSocketSessionValid(
        { ...session, user: { isActive: true, role: UserRole.KITCHEN } },
        now,
      ),
    ).toBe(false);
    expect(
      isAdminSocketSessionValid({ ...session, revokedAt: now }, now),
    ).toBe(false);
    expect(
      isAdminSocketSessionValid({ ...session, idleExpiresAt: now }, now),
    ).toBe(false);
  });

  it("parses cookies and protocols without logging or decoding failures", () => {
    expect(parseCookies("a=1; session=abc%2D123; malformed=%E0%A4%A")).toEqual({
      a: "1",
      session: "abc-123",
    });
    const request = {
      headers: {
        "sec-websocket-protocol":
          "gokboru.order.v1, order.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq",
      },
    } as unknown as IncomingMessage;
    expect(parseProtocols(request)).toEqual([
      "gokboru.order.v1",
      "order.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq",
    ]);
    expect(
      extractOrderToken([
        "gokboru.order.v1",
        `order.${"A".repeat(43)}`,
      ]),
    ).toBe("A".repeat(43));
    expect(extractOrderToken(["order.short"])).toBeNull();
  });
});
