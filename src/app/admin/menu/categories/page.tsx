import Link from "next/link";
import {
  createCategoryAction,
  deactivateCategoryAction,
  updateCategoryAction,
} from "../actions";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";
import { getPrisma } from "@/lib/db/prisma";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function CategoriesPage({ searchParams }: PageProps) {
  await requirePagePermission(
    PERMISSIONS.MENU_MANAGE,
    "/admin/menu/categories",
  );
  const categories = await getPrisma().category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const { error } = await searchParams;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Menü yönetimi</p>
          <h1>Kategoriler</h1>
        </div>
        <Link className="button button-secondary" href="/admin/menu">
          Menü yönetimine dön
        </Link>
      </header>
      {error ? (
        <p className="form-error" role="alert">
          {error === "duplicate"
            ? "Aynı ada karşılık gelen kategori zaten var."
            : "Kategori bilgileri geçersiz."}
        </p>
      ) : null}
      <section className="management-card">
        <h2>Yeni kategori</h2>
        <CategoryForm action={createCategoryAction} />
      </section>
      <section className="management-list">
        {categories.map((category) => (
          <article className="management-card" key={category.id}>
            <h2>{category.name}</h2>
            <CategoryForm action={updateCategoryAction} category={category} />
            {category.isActive ? (
              <form action={deactivateCategoryAction}>
                <input name="id" type="hidden" value={category.id} />
                <button className="button button-danger" type="submit">
                  Silmeden pasife al
                </button>
              </form>
            ) : (
              <p className="status">Pasif kategori</p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}

function CategoryForm({
  action,
  category,
}: {
  action: (formData: FormData) => Promise<void>;
  category?: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    sortOrder: number;
    isActive: boolean;
  };
}) {
  return (
    <form action={action} className="catalog-form">
      {category ? <input name="id" type="hidden" value={category.id} /> : null}
      <label>
        Ad
        <input defaultValue={category?.name} name="name" required />
      </label>
      <label>
        Açıklama
        <textarea defaultValue={category?.description ?? ""} name="description" />
      </label>
      <label>
        Fotoğraf HTTPS URL
        <input
          defaultValue={category?.imageUrl ?? ""}
          name="imageUrl"
          placeholder="https://..."
          type="url"
        />
      </label>
      <label>
        Sıra
        <input
          defaultValue={category?.sortOrder ?? 0}
          min="0"
          name="sortOrder"
          type="number"
        />
      </label>
      <label className="checkbox-field">
        <input
          defaultChecked={category?.isActive ?? true}
          name="isActive"
          type="checkbox"
        />
        Aktif
      </label>
      <button className="button button-primary" type="submit">
        {category ? "Kategoriyi güncelle" : "Kategori ekle"}
      </button>
    </form>
  );
}
