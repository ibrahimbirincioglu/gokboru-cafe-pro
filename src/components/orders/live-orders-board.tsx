"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LiveDashboardDto,
  LiveOrderDto,
} from "@/features/orders/live-types";
import { nextOrderStatus } from "@/features/orders/status";
import { useRealtimeEvents } from "@/lib/realtime/client";

export function LiveOrdersBoard() {
  const [dashboard, setDashboard] = useState<LiveDashboardDto | null>(null);
  const [error, setError] = useState("");
  const [visualAlert, setVisualAlert] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const knownOrderIds = useRef(new Set<string>());
  const initialized = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);

  const alertNewOrder = useCallback((message: string) => {
    setVisualAlert(message);
    window.setTimeout(() => setVisualAlert(""), 8_000);
    if (audioContext.current) {
      const oscillator = audioContext.current.createOscillator();
      const gain = audioContext.current.createGain();
      oscillator.frequency.setValueAtTime(880, audioContext.current.currentTime);
      gain.gain.setValueAtTime(0.12, audioContext.current.currentTime);
      oscillator.connect(gain);
      gain.connect(audioContext.current.destination);
      oscillator.start();
      oscillator.stop(audioContext.current.currentTime + 0.35);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      if (!response.ok) throw new Error("Siparişler alınamadı.");
      const next = (await response.json()) as LiveDashboardDto;
      if (initialized.current) {
        const newOrders = next.orders.filter(
          (order) =>
            order.status === "BEKLIYOR" &&
            !knownOrderIds.current.has(order.id),
        );
        if (newOrders.length) {
          alertNewOrder(
            `${newOrders.length} yeni sipariş geldi: ${newOrders
              .map((order) => order.tableName)
              .join(", ")}`,
          );
        }
      }
      knownOrderIds.current = new Set(next.orders.map((order) => order.id));
      initialized.current = true;
      setDashboard(next);
      setError("");
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Siparişler alınamadı.",
      );
    }
  }, [alertNewOrder]);

  const handleEvent = useCallback(
    () => {
      void refresh();
    },
    [refresh],
  );
  const realtimeState = useRealtimeEvents({
    protocols: ["gokboru.admin.v1"],
    onEvent: handleEvent,
  });

  useEffect(() => {
    void refresh();
    const polling = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(polling);
  }, [refresh]);

  async function advance(order: LiveOrderDto) {
    const next = nextOrderStatus(order.status);
    if (!next) return;
    const response = await fetch(`/api/admin/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, version: order.version }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Durum değiştirilemedi.");
    }
    await refresh();
  }

  function enableSound() {
    audioContext.current ??= new AudioContext();
    void audioContext.current.resume();
    setSoundEnabled(true);
  }

  return (
    <>
      <div className="live-toolbar">
        <span className={`live-connection live-${realtimeState}`}>
          Canlı bağlantı: {realtimeState}
        </span>
        <span>Polling: 10 saniye</span>
        <button className="button button-secondary" type="button" onClick={enableSound}>
          {soundEnabled ? "Ses açık" : "Ses uyarısını etkinleştir"}
        </button>
      </div>
      {visualAlert ? <div className="live-alert" role="alert">{visualAlert}</div> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <section className="management-card">
        <h2>Masalar</h2>
        <div className="live-table-grid">
          {dashboard?.tables.map((table) => (
            <article className={`live-table-card state-${table.state}`} key={table.id}>
              <div className="management-title">
                <h3>{table.name}</h3>
                <strong>{table.state === "BOS" ? "BOŞ" : table.state === "DOLU" ? "DOLU" : "PASİF"}</strong>
              </div>
              <p>Açık toplam: {table.openTotal} TL</p>
              <p>Son sipariş: {table.lastOrderAt ? new Date(table.lastOrderAt).toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul" }) : "—"}</p>
              {table.paymentRequested ? <p className="payment-request">Ödeme talebi var</p> : null}
            </article>
          ))}
        </div>
      </section>
      <section className="management-card">
        <h2>Siparişler</h2>
        <div className="live-order-grid">
          {dashboard?.orders.map((order) => {
            const next = nextOrderStatus(order.status);
            return (
              <article className="live-order-card" key={order.id}>
                <div className="management-title">
                  <div>
                    <h3>{order.tableName}</h3>
                    <small>{order.orderNumber}</small>
                  </div>
                  <strong className={`order-status status-${order.status}`}>{order.status}</strong>
                </div>
                <p>{new Date(order.createdAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</p>
                {order.items.map((item) => (
                  <div className="live-order-item" key={item.id}>
                    <strong>{item.quantity} × {item.name}</strong>
                    {item.options.length ? <small>{item.options.join(", ")}</small> : null}
                    {item.note ? <small>Not: {item.note}</small> : null}
                  </div>
                ))}
                {order.customerNote ? <p>Sipariş notu: {order.customerNote}</p> : null}
                <p className="guest-price">{order.total} TL</p>
                {next ? (
                  <button className="button button-primary" type="button" onClick={() => void advance(order)}>
                    {next} yap
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
