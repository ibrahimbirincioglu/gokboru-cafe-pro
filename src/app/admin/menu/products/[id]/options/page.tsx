import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deactivateOptionEntityAction,
  saveOptionAction,
  saveOptionGroupAction,
} from "../../../actions";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";
import { getPrisma } from "@/lib/db/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function ProductOptionsPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  await requirePagePermission(
    PERMISSIONS.MENU_MANAGE,
    `/admin/menu/products/${id}/options`,
  );
  const product = await getPrisma().product.findUnique({
    where: { id },
    include: {
      optionGroups: {
        include: { options: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!product) notFound();

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">{product.name}</p>
          <h1>Ürün seçenekleri</h1>
        </div>
        <Link className="button button-secondary" href="/admin/menu/products">
          Ürünlere dön
        </Link>
      </header>
      {error ? (
        <p className="form-error" role="alert">
          Seçenek bilgileri geçersiz veya yineleniyor.
        </p>
      ) : null}
      <section className="management-card">
        <h2>Yeni seçenek grubu</h2>
        <GroupForm productId={product.id} />
      </section>
      <section className="management-list">
        {product.optionGroups.map((group) => (
          <article className="management-card" key={group.id}>
            <h2>{group.name}</h2>
            <GroupForm group={group} productId={product.id} />
            <form action={deactivateOptionEntityAction}>
              <input name="id" type="hidden" value={group.id} />
              <input name="productId" type="hidden" value={product.id} />
              <input name="type" type="hidden" value="group" />
              <button className="button button-danger" type="submit">
                Grubu pasife al
              </button>
            </form>
            <h3>Seçenekler</h3>
            {group.options.map((option) => (
              <div className="option-row" key={option.id}>
                <OptionForm groupId={group.id} option={option} productId={product.id} />
                <form action={deactivateOptionEntityAction}>
                  <input name="id" type="hidden" value={option.id} />
                  <input name="productId" type="hidden" value={product.id} />
                  <input name="type" type="hidden" value="option" />
                  <button className="button button-danger" type="submit">
                    Pasife al
                  </button>
                </form>
              </div>
            ))}
            <h3>Yeni seçenek</h3>
            <OptionForm groupId={group.id} productId={product.id} />
          </article>
        ))}
      </section>
    </main>
  );
}

function GroupForm({
  productId,
  group,
}: {
  productId: string;
  group?: {
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    required: boolean;
    isActive: boolean;
    sortOrder: number;
  };
}) {
  return (
    <form action={saveOptionGroupAction} className="catalog-form">
      <input name="productId" type="hidden" value={productId} />
      {group ? <input name="id" type="hidden" value={group.id} /> : null}
      <label>Ad<input defaultValue={group?.name} name="name" required /></label>
      <label>Minimum seçim<input defaultValue={group?.minSelect ?? 0} min="0" name="minSelect" type="number" /></label>
      <label>Maksimum seçim<input defaultValue={group?.maxSelect ?? 1} min="1" name="maxSelect" type="number" /></label>
      <label>Sıra<input defaultValue={group?.sortOrder ?? 0} min="0" name="sortOrder" type="number" /></label>
      <label className="checkbox-field"><input defaultChecked={group?.required} name="required" type="checkbox" />Zorunlu</label>
      <label className="checkbox-field"><input defaultChecked={group?.isActive ?? true} name="isActive" type="checkbox" />Aktif</label>
      <button className="button button-primary" type="submit">{group ? "Grubu güncelle" : "Grup ekle"}</button>
    </form>
  );
}

function OptionForm({
  groupId,
  productId,
  option,
}: {
  groupId: string;
  productId: string;
  option?: { id: string; name: string; priceDelta: { toFixed(value: number): string }; isActive: boolean; sortOrder: number };
}) {
  return (
    <form action={saveOptionAction} className="catalog-form option-form">
      <input name="groupId" type="hidden" value={groupId} />
      <input name="productId" type="hidden" value={productId} />
      {option ? <input name="id" type="hidden" value={option.id} /> : null}
      <label>Ad<input defaultValue={option?.name} name="name" required /></label>
      <label>Fiyat farkı<input defaultValue={option?.priceDelta.toFixed(2) ?? "0.00"} name="priceDelta" required /></label>
      <label>Sıra<input defaultValue={option?.sortOrder ?? 0} min="0" name="sortOrder" type="number" /></label>
      <label className="checkbox-field"><input defaultChecked={option?.isActive ?? true} name="isActive" type="checkbox" />Aktif</label>
      <button className="button button-secondary" type="submit">{option ? "Güncelle" : "Ekle"}</button>
    </form>
  );
}
