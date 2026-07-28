import Link from "next/link";
import type { PrepStation } from "@prisma/client";
import {
  createProductAction,
  deactivateProductAction,
  toggleAvailabilityAction,
  updateProductAction,
} from "../actions";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";
import { getPrisma } from "@/lib/db/prisma";

type PageProps = { searchParams: Promise<{ error?: string }> };

export default async function ProductsPage({ searchParams }: PageProps) {
  await requirePagePermission(
    PERMISSIONS.MENU_MANAGE,
    "/admin/menu/products",
  );
  const [categories, products] = await Promise.all([
    getPrisma().category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    getPrisma().product.findMany({
      include: { category: true, _count: { select: { optionGroups: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  const { error } = await searchParams;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Menü yönetimi</p>
          <h1>Ürünler</h1>
        </div>
        <Link className="button button-secondary" href="/admin/menu">
          Menü yönetimine dön
        </Link>
      </header>
      {error ? (
        <p className="form-error" role="alert">
          {error === "duplicate"
            ? "Aynı ada karşılık gelen ürün zaten var."
            : "Ürün bilgileri geçersiz."}
        </p>
      ) : null}
      <section className="management-card">
        <h2>Yeni ürün</h2>
        <ProductForm action={createProductAction} categories={categories} />
      </section>
      <section className="management-list">
        {products.map((product) => (
          <article className="management-card" key={product.id}>
            <div className="management-title">
              <h2>{product.name}</h2>
              <span className="status">
                {product.category.name} · {product.price.toFixed(2)} TL
              </span>
            </div>
            <ProductForm
              action={updateProductAction}
              categories={categories}
              product={{
                ...product,
                price: product.price.toFixed(2),
                discountPrice: product.discountPrice?.toFixed(2) ?? "",
              }}
            />
            <div className="management-actions">
              <Link
                className="button button-secondary"
                href={`/admin/menu/products/${product.id}/options`}
              >
                Seçenekler ({product._count.optionGroups})
              </Link>
              <form action={toggleAvailabilityAction}>
                <input name="id" type="hidden" value={product.id} />
                <input
                  name="isAvailable"
                  type="hidden"
                  value={String(!product.isAvailable)}
                />
                <button className="button button-secondary" type="submit">
                  {product.isAvailable ? "Tükendi işaretle" : "Satışa aç"}
                </button>
              </form>
              {product.isActive ? (
                <form action={deactivateProductAction}>
                  <input name="id" type="hidden" value={product.id} />
                  <button className="button button-danger" type="submit">
                    Silmeden pasife al
                  </button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

type CategoryOption = { id: string; name: string; isActive: boolean };
type ProductFormValue = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  discountPrice: string;
  prepStation: PrepStation;
  sortOrder: number;
  isActive: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  allowNote: boolean;
};

function ProductForm({
  action,
  categories,
  product,
}: {
  action: (formData: FormData) => Promise<void>;
  categories: CategoryOption[];
  product?: ProductFormValue;
}) {
  return (
    <form action={action} className="catalog-form catalog-form-wide">
      {product ? <input name="id" type="hidden" value={product.id} /> : null}
      <label>
        Kategori
        <select defaultValue={product?.categoryId} name="categoryId" required>
          <option value="">Seçin</option>
          {categories.map((category) => (
            <option disabled={!category.isActive} key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ad
        <input defaultValue={product?.name} name="name" required />
      </label>
      <label>
        Fiyat
        <input defaultValue={product?.price} inputMode="decimal" name="price" required />
      </label>
      <label>
        İndirimli fiyat
        <input defaultValue={product?.discountPrice} inputMode="decimal" name="discountPrice" />
      </label>
      <label>
        Hazırlama alanı
        <select defaultValue={product?.prepStation ?? "MUTFAK"} name="prepStation">
          <option value="BAR">Bar</option>
          <option value="MUTFAK">Mutfak</option>
          <option value="NARGILE">Nargile</option>
        </select>
      </label>
      <label>
        Sıra
        <input defaultValue={product?.sortOrder ?? 0} min="0" name="sortOrder" type="number" />
      </label>
      <label className="full-field">
        Açıklama
        <textarea defaultValue={product?.description ?? ""} name="description" />
      </label>
      <label className="full-field">
        Fotoğraf HTTPS URL
        <input defaultValue={product?.imageUrl ?? ""} name="imageUrl" type="url" />
      </label>
      {(["isActive", "isAvailable", "isFeatured", "allowNote"] as const).map((field) => (
        <label className="checkbox-field" key={field}>
          <input
            defaultChecked={product ? product[field] : field !== "isFeatured"}
            name={field}
            type="checkbox"
          />
          {field === "isActive"
            ? "Aktif"
            : field === "isAvailable"
              ? "Satışta"
              : field === "isFeatured"
                ? "Öne çıkan"
                : "Not kabul et"}
        </label>
      ))}
      <button className="button button-primary" type="submit">
        {product ? "Ürünü güncelle" : "Ürün ekle"}
      </button>
    </form>
  );
}
