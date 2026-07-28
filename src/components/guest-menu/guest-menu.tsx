"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string; priceDelta: string };
type OptionGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  options: Option[];
};
type Product = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  discountPrice: string | null;
  allowNote: boolean;
  optionGroups: OptionGroup[];
};
type Category = {
  id: string;
  name: string;
  description: string | null;
  products: Product[];
};
type CartItem = {
  key: string;
  productId: string;
  productName: string;
  quantity: number;
  note: string;
  optionIds: string[];
  optionNames: string[];
};

export function GuestMenu({
  cartKey,
  categories,
  qrToken,
  tableName,
}: {
  cartKey: string;
  categories: Category[];
  qrToken: string;
  tableName: string;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [customerNote, setCustomerNote] = useState("");
  const [status, setStatus] = useState("Misafir oturumu hazırlanıyor…");
  const [sessionReady, setSessionReady] = useState(false);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const storageKey = useMemo(() => `gokboru-cart-${cartKey}`, [cartKey]);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        queueMicrotask(() => setCart(JSON.parse(saved) as CartItem[]));
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
    queueMicrotask(() => setCartHydrated(true));
    void fetch("/api/guest/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken }),
    }).then(async (response) => {
      if (!response.ok) throw new Error("Misafir oturumu açılamadı.");
      setSessionReady(true);
      setStatus("Sipariş vermeye hazırsınız.");
    }).catch(() => setStatus("Oturum açılamadı. Sayfayı yenileyin."));
  }, [qrToken, storageKey]);

  useEffect(() => {
    if (cartHydrated) {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    }
  }, [cart, cartHydrated, storageKey]);

  function toggleOption(product: Product, group: OptionGroup, optionId: string) {
    const current = selections[product.id] ?? [];
    const groupIds = new Set(group.options.map((option) => option.id));
    const selectedInGroup = current.filter((id) => groupIds.has(id));
    let next: string[];
    if (group.maxSelect === 1) {
      next = [...current.filter((id) => !groupIds.has(id)), optionId];
    } else if (current.includes(optionId)) {
      next = current.filter((id) => id !== optionId);
    } else if (selectedInGroup.length < group.maxSelect) {
      next = [...current, optionId];
    } else {
      setStatus(`${group.name} için en fazla ${group.maxSelect} seçim yapılabilir.`);
      return;
    }
    setSelections({ ...selections, [product.id]: next });
  }

  function addProduct(product: Product) {
    const optionIds = selections[product.id] ?? [];
    for (const group of product.optionGroups) {
      const groupIds = new Set(group.options.map((option) => option.id));
      const count = optionIds.filter((id) => groupIds.has(id)).length;
      const minimum = group.required ? Math.max(1, group.minSelect) : group.minSelect;
      if (count < minimum || count > group.maxSelect) {
        setStatus(`${group.name} seçimlerini kontrol edin.`);
        return;
      }
    }
    const optionNames = product.optionGroups.flatMap((group) =>
      group.options.filter((option) => optionIds.includes(option.id)).map((option) => option.name),
    );
    setCart((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        productId: product.id,
        productName: product.name,
        quantity: 1,
        note: product.allowNote ? notes[product.id] ?? "" : "",
        optionIds,
        optionNames,
      },
    ]);
    setStatus(`${product.name} sepete eklendi.`);
  }

  async function submitOrder() {
    if (!sessionReady || cart.length === 0 || submitting) return;
    setSubmitting(true);
    setStatus("Siparişiniz güvenli biçimde gönderiliyor…");
    try {
      const response = await fetch("/api/guest/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrToken,
          idempotencyKey,
          customerNote,
          items: cart.map(({ productId, quantity, note, optionIds }) => ({
            productId,
            quantity,
            note,
            optionIds,
          })),
        }),
      });
      const body = (await response.json()) as { error?: string; trackingPath?: string };
      if (!response.ok || !body.trackingPath) {
        throw new Error(body.error ?? "Sipariş gönderilemedi.");
      }
      setCart([]);
      localStorage.removeItem(storageKey);
      setIdempotencyKey(crypto.randomUUID());
      router.push(body.trackingPath);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sipariş gönderilemedi.");
      setSubmitting(false);
    }
  }

  return (
    <main className="guest-menu-shell">
      <header className="guest-menu-header">
        <p className="eyebrow">Gökbörü Cafe · {tableName}</p>
        <h1>Menü</h1>
        <p className="status" role="status">{status}</p>
      </header>
      <div className="guest-menu-layout">
        <div>
          {categories.map((category) => (
            <section className="guest-category" key={category.id}>
              <h2>{category.name}</h2>
              {category.description ? <p>{category.description}</p> : null}
              <div className="guest-products">
                {category.products.map((product) => (
                  <article className="guest-product" key={product.id}>
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- externally managed catalog URL
                      <img src={product.imageUrl} alt="" />
                    ) : null}
                    <h3>{product.name}</h3>
                    {product.description ? <p>{product.description}</p> : null}
                    <p className="guest-price">
                      {product.discountPrice ?? product.price} TL
                      {product.discountPrice ? <del>{product.price} TL</del> : null}
                    </p>
                    {product.optionGroups.map((group) => (
                      <fieldset key={group.id}>
                        <legend>{group.name} ({group.minSelect}–{group.maxSelect})</legend>
                        {group.options.map((option) => (
                          <label className="guest-option" key={option.id}>
                            <input
                              checked={(selections[product.id] ?? []).includes(option.id)}
                              name={`${product.id}-${group.id}`}
                              type={group.maxSelect === 1 ? "radio" : "checkbox"}
                              onChange={() => toggleOption(product, group, option.id)}
                            />
                            {option.name} {option.priceDelta !== "0.00" ? `(+${option.priceDelta} TL)` : ""}
                          </label>
                        ))}
                      </fieldset>
                    ))}
                    {product.allowNote ? (
                      <label>Ürün notu
                        <textarea
                          maxLength={300}
                          value={notes[product.id] ?? ""}
                          onChange={(event) => setNotes({ ...notes, [product.id]: event.target.value })}
                        />
                      </label>
                    ) : null}
                    <button className="button button-primary" type="button" onClick={() => addProduct(product)}>
                      Sepete ekle
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside className="guest-cart">
          <h2>Sepet ({cart.length})</h2>
          {cart.length === 0 ? <p>Sepetiniz boş.</p> : cart.map((item) => (
            <div className="guest-cart-item" key={item.key}>
              <strong>{item.productName}</strong>
              {item.optionNames.length ? <small>{item.optionNames.join(", ")}</small> : null}
              {item.note ? <small>Not: {item.note}</small> : null}
              <label>Adet
                <input
                  min="1"
                  max="20"
                  type="number"
                  value={item.quantity}
                  onChange={(event) => setCart((current) => current.map((entry) =>
                    entry.key === item.key
                      ? { ...entry, quantity: Math.min(20, Math.max(1, Number(event.target.value))) }
                      : entry,
                  ))}
                />
              </label>
              <button className="button button-danger" type="button" onClick={() => setCart((current) => current.filter((entry) => entry.key !== item.key))}>
                Kaldır
              </button>
            </div>
          ))}
          <label>Sipariş notu
            <textarea maxLength={500} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} />
          </label>
          <p className="status">Nihai tutar güncel fiyatlarla sunucuda hesaplanır.</p>
          <button className="button button-primary" disabled={!sessionReady || !cart.length || submitting} type="button" onClick={submitOrder}>
            {submitting ? "Gönderiliyor…" : "Siparişi gönder"}
          </button>
        </aside>
      </div>
    </main>
  );
}
