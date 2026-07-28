"use client";

import { useEffect, useRef, useState } from "react";
import { EventDeduplicator, reconnectDelay } from "./dedupe";

export type RealtimeState = "connecting" | "connected" | "disconnected";

export function useRealtimeEvents({
  protocols,
  onEvent,
}: {
  protocols: string[];
  onEvent: (event: {
    eventId: string;
    type: "ORDER_CREATED" | "ORDER_STATUS_CHANGED";
    orderId: string;
  }) => void;
}) {
  const [state, setState] = useState<RealtimeState>("connecting");
  const onEventRef = useRef(onEvent);
  const protocolsKey = protocols.join(",");

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let attempt = 0;
    const deduplicator = new EventDeduplicator();

    function connect() {
      if (closed) return;
      setState("connecting");
      const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(
        `${scheme}//${window.location.host}/ws`,
        protocolsKey.split(","),
      );
      socket.onopen = () => {
        attempt = 0;
        setState("connected");
      };
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(String(message.data)) as {
            eventId?: string;
            type?: string;
            orderId?: string;
          };
          if (
            !event.eventId ||
            !event.orderId ||
            (event.type !== "ORDER_CREATED" &&
              event.type !== "ORDER_STATUS_CHANGED") ||
            !deduplicator.accept(event.eventId)
          ) {
            return;
          }
          onEventRef.current({
            eventId: event.eventId,
            type: event.type,
            orderId: event.orderId,
          });
        } catch {
          // Invalid frames are ignored; PostgreSQL polling remains authoritative.
        }
      };
      socket.onclose = () => {
        if (closed) return;
        setState("disconnected");
        const delay = reconnectDelay(attempt);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
      socket.onerror = () => socket?.close();
    }

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [protocolsKey]);

  return state;
}
