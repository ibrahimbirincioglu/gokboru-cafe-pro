"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeEvents } from "@/lib/realtime/client";

type Product = {
  id: string;
  name: string;
  price: string;
  allowNote: boolean;
  optionGroups: Array<{
    id: string;
    name: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    options: Array<{ id: string; name: string; priceDelta: string }>;
  }>;
};
type PosSession = {
  id: string;
  tableName: string;
  status: string;
  discountReason: string | null;
  totals: { subtotal: string; discountTotal: string; amount: string };
  categories: Array<{ id: string; name: string; products: Product[] }>;
  orders: Array<{
    id: string;
    orderNumber: string;
    source: string;
    status: string;
    createdAt: string;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      cancelledQuantity: number;
      unitPrice: string;
      note: string | null;
      options: string[];
    }>;
  }>;
};

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as { error?: string; paymentId?: string };
  if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı.");
  return result;
}

export function PosTable({
  initialSession,
  canAdjust,
}: {
  initialSession: PosSession;
  canAdjust: boolean;
}) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const products = useMemo(
    () => session.categories.flatMap((category) => category.products),
    [session.categories],
  );
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedProduct = products.find((product) => product.id === productId);
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/pos/sessions/${initialSession.id}`, {
      cache: "no-store",
    });
    if (response.status === 404) {
      router.replace("/pos");
      return;
    }
    if (response.ok) setSession((await response.json()) as PosSession);
  }, [initialSession.id, router]);
  useRealtimeEvents({
    protocols: ["gokboru.admin.v1"],
    onEvent: refresh,
  });
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pos-layout">
      <section>
        <h2>Sipariş turları</h2>
        {session.orders.map((order, index) => (
          <article className="live-order-card" key={order.id}>
            <h3>Tur {index + 1} · {order.orderNumber}</h3>
            <p className="muted">{order.source} · {order.status}</p>
            {order.items.map((item) => {
              const remaining = item.quantity - item.cancelledQuantity;
              return (
                <div className="live-order-item" key={item.id}>
                  <strong>{remaining}× {item.name} · ₺{item.unitPrice}</strong>
                  {!!item.cancelledQuantity && (
                    <small>{item.cancelledQuantity} adet iptal</small>
                  )}
                  {!!item.options.length && <small>{item.options.join(", ")}</small>}
                  {item.note && <small>Not: {item.note}</small>}
                  {canAdjust && remaining > 0 && (
                    <button
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => {
                        const reason = window.prompt("İptal gerekçesi (en az 3 karakter):");
                        if (!reason) return;
                        void run(() =>
                          post(`/api/pos/sessions/${session.id}/cancel`, {
                            itemId: item.id,
                            quantity: remaining,
                            reason,
                          }),
                        );
                      }}
                    >
                      Kalanı iptal et
                    </button>
                  )}
                </div>
              );
            })}
          </article>
        ))}
      </section>

      <aside className="guest-cart">
        <h2>Kasadan ürün ekle</h2>
        <label>
          Ürün
          <select
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setOptionIds([]);
            }}
          >
            {session.categories.map((category) => (
              <optgroup label={category.name} key={category.id}>
                {category.products.map((product) => (
                  <option value={product.id} key={product.id}>
                    {product.name} · ₺{product.price}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {selectedProduct?.optionGroups.map((group) => (
          <fieldset key={group.id}>
            <legend>
              {group.name} {group.required ? "(zorunlu)" : ""}
            </legend>
            {group.options.map((option) => (
              <label className="guest-option" key={option.id}>
                <input
                  type="checkbox"
                  checked={optionIds.includes(option.id)}
                  onChange={(event) =>
                    setOptionIds((current) =>
                      event.target.checked
                        ? [...current, option.id]
                        : current.filter((id) => id !== option.id),
                    )
                  }
                />
                {option.name} (+₺{option.priceDelta})
              </label>
            ))}
          </fieldset>
        ))}
        <label>
          Adet
          <input
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
        </label>
        <label>
          Not
          <textarea
            maxLength={300}
            disabled={selectedProduct ? !selectedProduct.allowNote : true}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <button
          className="button"
          disabled={busy || !selectedProduct}
          onClick={() =>
            void run(async () => {
              await post(`/api/pos/sessions/${session.id}/items`, {
                idempotencyKey: crypto.randomUUID(),
                customerNote: "",
                items: [{ productId, quantity, note, optionIds }],
              });
              setNote("");
              setOptionIds([]);
            })
          }
        >
          Sipariş turu ekle
        </button>

        <hr />
        <h2>Ödeme</h2>
        <p>Ara toplam: ₺{session.totals.subtotal}</p>
        <p>İndirim: ₺{session.totals.discountTotal}</p>
        <p className="guest-price">Ödenecek: ₺{session.totals.amount}</p>
        {session.discountReason && <p className="muted">{session.discountReason}</p>}
        {canAdjust && (
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={() => {
              const amount = window.prompt("İndirim tutarı:", session.totals.discountTotal);
              const reason = window.prompt("İndirim gerekçesi (en az 3 karakter):");
              if (amount === null || !reason) return;
              void run(() =>
                post(`/api/pos/sessions/${session.id}/discount`, { amount, reason }),
              );
            }}
          >
            İndirim uygula
          </button>
        )}
        {(["NAKIT", "KREDI_KARTI"] as const).map((paymentType) => (
          <button
            className="button"
            disabled={busy}
            key={paymentType}
            onClick={() => {
              const idempotencyKey = crypto.randomUUID();
              void run(async () => {
                const result = await post(
                  `/api/pos/sessions/${session.id}/payments`,
                  { paymentType, idempotencyKey },
                );
                router.push(`/pos/receipt/${result.paymentId}`);
              });
            }}
          >
            {paymentType === "NAKIT" ? "Nakit al" : "Kredi kartı al"}
          </button>
        ))}
        {message && <p className="form-error">{message}</p>}
      </aside>
    </div>
  );
}
