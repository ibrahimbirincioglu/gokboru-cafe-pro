import { ProtectedShell } from "@/components/auth/protected-shell";
import { getPublicSiteContent } from "@/features/public-site/server";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";
import { updatePublicSiteAction } from "./actions";

export default async function PublicSiteAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const auth = await requirePagePermission(PERMISSIONS.SITE_MANAGE, "/admin/site");
  const [content, query] = await Promise.all([getPublicSiteContent(), searchParams]);
  return (
    <ProtectedShell name={auth.user.name} role={auth.user.role} title="Halka açık site içeriği">
      <p className="muted">
        Gerçek işletme fotoğrafları ve videoları HTTPS adresleriyle ekleyin.
        Boş medya alanları hızlı, görselsiz tasarım fallback’ini kullanır.
      </p>
      {query.saved === "1" && <p className="form-success">Site içeriği yayımlandı.</p>}
      {query.error && <p className="form-error">Alanları ve HTTPS bağlantılarını kontrol edin.</p>}
      <form action={updatePublicSiteAction} className="site-admin-form">
        <fieldset>
          <legend>Marka, hero ve SEO</legend>
          <Field label="Kafe adı" name="siteName" value={content.siteName} />
          <Field label="Ana başlık" name="heroTitle" value={content.heroTitle} />
          <Field label="Ana açıklama" name="heroDescription" value={content.heroDescription} area />
          <Field label="Hero görsel HTTPS URL" name="heroImageUrl" value={content.heroImageUrl} type="url" />
          <Field label="Hero video HTTPS URL" name="heroVideoUrl" value={content.heroVideoUrl} type="url" />
          <Field label="SEO başlığı" name="seoTitle" value={content.seoTitle} />
          <Field label="SEO açıklaması" name="seoDescription" value={content.seoDescription} area />
          <Field label="Open Graph görsel HTTPS URL" name="ogImageUrl" value={content.ogImageUrl} type="url" />
        </fieldset>
        <fieldset>
          <legend>Tanıtım ve deneyimler</legend>
          <Field label="Hakkımızda başlığı" name="aboutTitle" value={content.aboutTitle} />
          <Field label="Hakkımızda metni" name="aboutText" value={content.aboutText} area />
          <Field label="Okey bölümü" name="okeyText" value={content.okeyText} area />
          <Field label="Nargile bölümü" name="nargileText" value={content.nargileText} area />
          <Field label="Hamburger bölümü" name="hamburgerText" value={content.hamburgerText} area />
          <Field label="Gözleme bölümü" name="gozlemeText" value={content.gozlemeText} area />
          <Field label="Duyuru" name="announcement" value={content.announcement} area />
          <Field label="Kampanya" name="campaign" value={content.campaign} area />
        </fieldset>
        <fieldset>
          <legend>Galeri ve iletişim</legend>
          <Field
            label="Galeri HTTPS URL’leri (her satıra bir görsel, en fazla 12)"
            name="galleryUrls"
            value={content.galleryUrls.join("\n")}
            area
          />
          <Field label="Çalışma saatleri" name="openingHours" value={content.openingHours} area />
          <Field label="Adres" name="address" value={content.address} area />
          <Field label="Google Maps embed HTTPS URL" name="mapEmbedUrl" value={content.mapEmbedUrl} type="url" />
          <Field label="Yol tarifi HTTPS URL" name="directionsUrl" value={content.directionsUrl} type="url" />
          <Field label="Telefon" name="phone" value={content.phone} type="tel" />
          <Field label="WhatsApp numarası (ülke koduyla, yalnızca rakam)" name="whatsapp" value={content.whatsapp} />
          <Field label="Instagram HTTPS URL" name="instagramUrl" value={content.instagramUrl} type="url" />
        </fieldset>
        <button className="button button-primary" type="submit">İçeriği doğrula ve yayımla</button>
      </form>
    </ProtectedShell>
  );
}

function Field({
  label, name, value, area = false, type = "text",
}: {
  label: string; name: string; value: string; area?: boolean; type?: string;
}) {
  return (
    <label>
      {label}
      {area ? (
        <textarea name={name} defaultValue={value} rows={4} />
      ) : (
        <input name={name} defaultValue={value} type={type} />
      )}
    </label>
  );
}
