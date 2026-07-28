import type { Metadata } from "next";
import Link from "next/link";
import { buildLocalBusinessJsonLd } from "@/features/public-site/content";
import { getFeaturedProducts, getPublicSiteContent } from "@/features/public-site/server";

export const dynamic = "force-dynamic";

function siteUrl() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublicSiteContent();
  const image = content.ogImageUrl || content.heroImageUrl || undefined;
  return {
    title: content.seoTitle,
    description: content.seoDescription,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website", locale: "tr_TR", url: siteUrl(), siteName: content.siteName,
      title: content.seoTitle, description: content.seoDescription,
      images: image ? [{ url: image, alt: content.siteName }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: content.seoTitle, description: content.seoDescription,
      images: image ? [image] : undefined,
    },
  };
}

export default async function HomePage() {
  const [content, products] = await Promise.all([getPublicSiteContent(), getFeaturedProducts()]);
  const phoneHref = content.phone ? `tel:${content.phone.replace(/[^\d+]/g, "")}` : "";
  const whatsappHref = content.whatsapp ? `https://wa.me/${content.whatsapp}` : "";
  const images = content.galleryUrls;
  const structuredData = buildLocalBusinessJsonLd(content, siteUrl().toString());
  return (
    <>
      <a className="skip-link" href="#ana-icerik">Ana içeriğe geç</a>
      <header className="public-header">
        <Link className="public-brand" href="/" aria-label={`${content.siteName} ana sayfa`}>
          <span aria-hidden="true">G</span>{content.siteName}
        </Link>
        <nav aria-label="Ana menü">
          <a href="#hakkimizda">Hakkımızda</a><a href="#menu">Menü</a>
          <a href="#deneyimler">Deneyimler</a><a href="#galeri">Galeri</a><a href="#iletisim">İletişim</a>
        </nav>
      </header>
      <main id="ana-icerik" className="public-site">
        <section className={`public-hero ${content.heroImageUrl ? "has-media" : ""}`} aria-labelledby="public-hero-title">
          <div className="hero-media" aria-hidden="true">
            {content.heroVideoUrl ? (
              <video autoPlay muted loop playsInline preload="metadata" poster={content.heroImageUrl || undefined}>
                <source src={content.heroVideoUrl} />
              </video>
            ) : content.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={content.heroImageUrl} alt="" width="1600" height="900" fetchPriority="high" />
            ) : <div className="hero-fallback"><span>GÖKBÖRÜ</span></div>}
          </div>
          <div className="hero-shade" />
          <div className="hero-copy">
            <p className="eyebrow">{content.siteName}</p>
            <h1 id="public-hero-title">{content.heroTitle}</h1>
            <p>{content.heroDescription}</p>
            <div className="actions">
              <a className="button button-primary" href="#menu">Menüye göz at</a>
              {content.directionsUrl && <a className="button public-button-ghost" href={content.directionsUrl} target="_blank" rel="noreferrer">Yol tarifi al</a>}
            </div>
          </div>
        </section>

        {content.announcement && <aside className="public-notice"><strong>Duyuru</strong><span>{content.announcement}</span></aside>}

        <section className="public-section public-about" id="hakkimizda" aria-labelledby="about-title">
          <div><p className="section-kicker">Biz kimiz?</p><h2 id="about-title">{content.aboutTitle}</h2></div>
          <p>{content.aboutText}</p>
        </section>

        <section className="public-section" id="menu" aria-labelledby="menu-title">
          <div className="section-heading">
            <div><p className="section-kicker">Masaya gelen favoriler</p><h2 id="menu-title">Menüden seçtiklerimiz</h2></div>
            <p>QR siparişi yalnızca kafedeki masanıza özel kod üzerinden verilir.</p>
          </div>
          {products.length ? <div className="menu-preview-grid">
            {products.map((product) => <article className="menu-preview-card" key={product.id}>
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt={`${product.name} sunumu`} width="640" height="480" loading="lazy" />
              ) : <div className="menu-image-fallback" aria-hidden="true">{product.name.slice(0, 1)}</div>}
              <div><span>{product.category.name}</span><h3>{product.name}</h3>
                {product.description && <p>{product.description}</p>}
                <strong>₺{(product.discountPrice ?? product.price).toFixed(2)}</strong>
              </div>
            </article>)}
          </div> : <p className="public-empty">Aktif menü ürünleri yayımlandığında burada görünecek.</p>}
        </section>

        <section className="public-section" id="deneyimler" aria-labelledby="experiences-title">
          <p className="section-kicker">Her buluşmaya ayrı bir tat</p><h2 id="experiences-title">Gökbörü’de seni ne bekliyor?</h2>
          <div className="experience-grid">
            <Experience number="01" title="Okey" text={content.okeyText} />
            <Experience number="02" title="Nargile" text={content.nargileText} />
            <Experience number="03" title="Hamburger" text={content.hamburgerText} />
            <Experience number="04" title="Gözleme" text={content.gozlemeText} />
          </div>
        </section>

        {content.campaign && <section className="campaign-banner" aria-labelledby="campaign-title">
          <p className="section-kicker">Güncel fırsat</p><h2 id="campaign-title">Kampanya</h2><p>{content.campaign}</p>
        </section>}

        <section className="public-section" id="galeri" aria-labelledby="gallery-title">
          <p className="section-kicker">Mekândan kareler</p><h2 id="gallery-title">Galeri</h2>
          {images.length ? <div className="gallery-grid">
            {images.map((image, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={image} src={image} alt={`${content.siteName} galeri fotoğrafı ${index + 1}`} width="900" height="700" loading="lazy" />
            ))}
          </div> : <div className="gallery-empty"><span aria-hidden="true">✦</span><p>Gerçek mekân fotoğrafları yayımlandığında galeri burada yer alacak.</p></div>}
        </section>

        <section className="public-contact" id="iletisim" aria-labelledby="contact-title">
          <div className="contact-copy">
            <p className="section-kicker">Bize ulaş</p><h2 id="contact-title">Bir masa, iyi bir sohbet.</h2>
            <div className="contact-details">
              <div><strong>Çalışma saatleri</strong><p className="preserve-lines">{content.openingHours}</p></div>
              <div><strong>Adres</strong><p>{content.address || "Güncel adres bilgisi yakında yayımlanacak."}</p></div>
            </div>
            <div className="actions">
              {phoneHref && <a className="button button-primary" href={phoneHref}>Telefon</a>}
              {whatsappHref && <a className="button public-button-ghost" href={whatsappHref} target="_blank" rel="noreferrer">WhatsApp</a>}
              {content.instagramUrl && <a className="button public-button-ghost" href={content.instagramUrl} target="_blank" rel="noreferrer">Instagram</a>}
            </div>
          </div>
          <div className="map-panel">
            {content.mapEmbedUrl ? <iframe src={content.mapEmbedUrl} title={`${content.siteName} haritası`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
              : <div><span aria-hidden="true">⌖</span><p>Harita konumu yönetim panelinden yayımlanabilir.</p></div>}
          </div>
        </section>
      </main>
      <footer className="public-footer"><strong>{content.siteName}</strong><p>Lezzet, oyun ve sohbet aynı masada.</p><a href="/admin/login">Çalışan girişi</a></footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} />
    </>
  );
}

function Experience({ number, title, text }: { number: string; title: string; text: string }) {
  return <article><span>{number}</span><h3>{title}</h3><p>{text}</p></article>;
}
