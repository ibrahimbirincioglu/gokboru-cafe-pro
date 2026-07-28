"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRealtimeEvents } from "@/lib/realtime/client";

type Session = {
  id: string;
  tableName: string;
  status: string;
  roundCount: number;
  lastOrderAt: string | null;
  subtotal: string;
  discountTotal: string;
  amount: string;
};

export function PosBoard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/pos/sessions", { cache: "no-store" });
    if (!response.ok) {
      setError("Açık masalar alınamadı.");
      return;
    }
    const body = (await response.json()) as { sessions: Session[] };
    setSessions(body.sessions);
    setError("");
  }, []);
  const realtime = useRealtimeEvents({
    protocols: ["gokboru.admin.v1"],
    onEvent: refresh,
  });

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 10_000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh]);

  return (
    <div>
      <div className="live-toolbar">
        <span className={`live-connection live-${realtime}`}>
          Canlı bağlantı: {realtime}
        </span>
        <button className="button button-secondary" onClick={() => void refresh()}>
          Yenile
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {!sessions.length && <p className="muted">Açık masa yok.</p>}
      <div className="live-table-grid">
        {sessions.map((session) => (
          <article className="live-table-card state-DOLU" key={session.id}>
            <h3>{session.tableName}</h3>
            <p>{session.roundCount} sipariş turu</p>
            <p>Ara toplam: ₺{session.subtotal}</p>
            <p>İndirim: ₺{session.discountTotal}</p>
            <p className="guest-price">Ödenecek: ₺{session.amount}</p>
            <p className="muted">
              Son sipariş:{" "}
              {session.lastOrderAt
                ? new Date(session.lastOrderAt).toLocaleString("tr-TR")
                : "—"}
            </p>
            <Link className="button" href={`/pos/table/${session.id}`}>
              Masayı aç
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
