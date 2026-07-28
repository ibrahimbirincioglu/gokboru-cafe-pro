"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicOrderTrackingDto } from "@/features/orders/tracking";
import { ORDER_STATUS_SEQUENCE } from "@/features/orders/status";
import { useRealtimeEvents } from "@/lib/realtime/client";

export function OrderTracker({
  initialOrder,
  publicToken,
}: {
  initialOrder: PublicOrderTrackingDto;
  publicToken: string;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/${publicToken}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Sipariş durumu alınamadı.");
      setOrder((await response.json()) as PublicOrderTrackingDto);
      setError("");
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Sipariş durumu alınamadı.",
      );
    }
  }, [publicToken]);
  const realtimeState = useRealtimeEvents({
    protocols: ["gokboru.order.v1", `order.${publicToken}`],
    onEvent: useCallback(() => void refresh(), [refresh]),
  });

  useEffect(() => {
    const polling = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(polling);
  }, [refresh]);

  const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(
    order.status as (typeof ORDER_STATUS_SEQUENCE)[number],
  );
  return (
    <>
      <p className="eyebrow">{order.tableName} · {order.orderNumber}</p>
      <h1>Siparişiniz</h1>
      <p className="lead">
        Durum: <strong>{order.status}</strong>
      </p>
      <ol className="order-progress">
        {ORDER_STATUS_SEQUENCE.map((status, index) => (
          <li className={index <= currentIndex ? "is-complete" : ""} key={status}>
            {status}
          </li>
        ))}
      </ol>
      <div className="tracking-items">
        {order.items.map((item) => (
          <div key={item.id}>
            <strong>{item.quantity} × {item.name}</strong>
            <span>{item.lineSubtotal} TL</span>
            {item.options.length ? <small>{item.options.join(", ")}</small> : null}
          </div>
        ))}
      </div>
      <p className="lead">Toplam: <strong>{order.total} TL</strong></p>
      <p className={`live-connection live-${realtimeState}`}>
        Canlı bağlantı: {realtimeState} · Polling yedeği: 10 saniye
      </p>
      {error ? <p className="form-error">{error}</p> : null}
    </>
  );
}
