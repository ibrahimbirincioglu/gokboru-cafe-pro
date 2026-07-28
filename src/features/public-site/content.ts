import { z } from "zod";

const httpsUrl = z.union([
  z.literal(""),
  z.url().refine((value) => value.startsWith("https://"), "Yalnızca HTTPS URL kullanılabilir."),
]);

export const publicSiteSchema = z.object({
  siteName: z.string().trim().min(2).max(80),
  heroTitle: z.string().trim().min(5).max(120),
  heroDescription: z.string().trim().min(10).max(400),
  heroImageUrl: httpsUrl,
  heroVideoUrl: httpsUrl,
  aboutTitle: z.string().trim().min(3).max(100),
  aboutText: z.string().trim().min(10).max(1_500),
  okeyText: z.string().trim().min(10).max(600),
  nargileText: z.string().trim().min(10).max(600),
  hamburgerText: z.string().trim().min(10).max(600),
  gozlemeText: z.string().trim().min(10).max(600),
  galleryUrls: z.array(httpsUrl).max(12),
  openingHours: z.string().trim().min(3).max(1_000),
  address: z.string().trim().max(500),
  mapEmbedUrl: httpsUrl.refine(
    (value) => !value || /^https:\/\/(www\.)?google\.com\/maps\/embed/.test(value),
    "Harita gömme adresi Google Maps HTTPS embed URL olmalıdır.",
  ),
  directionsUrl: httpsUrl,
  phone: z.union([z.literal(""), z.string().regex(/^\+?[0-9 ()-]{7,25}$/)]),
  whatsapp: z.union([z.literal(""), z.string().regex(/^[0-9]{10,15}$/)]),
  instagramUrl: httpsUrl.refine(
    (value) => !value || /^https:\/\/(www\.)?instagram\.com\//.test(value),
    "Instagram adresi instagram.com üzerinde olmalıdır.",
  ),
  announcement: z.string().trim().max(300),
  campaign: z.string().trim().max(500),
  seoTitle: z.string().trim().min(10).max(70),
  seoDescription: z.string().trim().min(30).max(170),
  ogImageUrl: httpsUrl,
});

export type PublicSiteContent = z.infer<typeof publicSiteSchema>;

export const DEFAULT_PUBLIC_SITE: PublicSiteContent = {
  siteName: "Gökbörü Cafe",
  heroTitle: "Sohbetin, lezzetin ve keyfin buluşma noktası.",
  heroDescription:
    "Okey masalarından özenli nargile sunumlarına, sıcak gözlemeden doyurucu hamburgere uzanan samimi bir kafe deneyimi.",
  heroImageUrl: "",
  heroVideoUrl: "",
  aboutTitle: "Gökbörü ruhuyla sıcak bir buluşma alanı",
  aboutText:
    "Arkadaşlarınla uzun sohbetlere, keyifli oyunlara ve iyi hazırlanmış lezzetlere yer açan modern bir mahalle kafesiyiz.",
  okeyText: "Rahat masalar ve uzun sohbetler için tasarlanan okey alanında oyunun keyfini arkadaşlarınla çıkar.",
  nargileText: "Özenli sunum, dengeli içim ve farklı aroma seçenekleriyle nargile molanı keyifli bir ritüele dönüştür.",
  hamburgerText: "Doyurucu hamburgerler, taze eşlikçiler ve sıcak servisle günün iştahlı anlarına güçlü bir seçenek.",
  gozlemeText: "Sıcak servis edilen gözlemeler, geleneksel lezzeti kafe keyfiyle aynı masada buluşturur.",
  galleryUrls: [],
  openingHours: "Güncel çalışma saatleri yönetim panelinden yayımlanır.",
  address: "",
  mapEmbedUrl: "",
  directionsUrl: "",
  phone: "",
  whatsapp: "",
  instagramUrl: "",
  announcement: "",
  campaign: "",
  seoTitle: "Gökbörü Cafe | Okey, Nargile ve Lezzet",
  seoDescription:
    "Gökbörü Cafe’de okey, nargile, hamburger, gözleme ve sıcak-soğuk içeceklerle keyifli bir kafe deneyimi yaşayın.",
  ogImageUrl: "",
};

export function parsePublicSite(value: unknown): PublicSiteContent {
  const parsed = publicSiteSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_PUBLIC_SITE;
}

export function formToPublicSite(formData: FormData) {
  const values = Object.fromEntries(formData.entries());
  return publicSiteSchema.parse({
    ...values,
    galleryUrls: String(values.galleryUrls ?? "")
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  });
}

export function safeExternalUrl(value: string) {
  if (!value) return "";
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Güvensiz bağlantı.");
  return url.toString();
}

export function buildLocalBusinessJsonLd(
  content: PublicSiteContent,
  url: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    name: content.siteName,
    description: content.seoDescription,
    url,
    telephone: content.phone || undefined,
    image:
      content.ogImageUrl ||
      content.heroImageUrl ||
      content.galleryUrls[0] ||
      undefined,
    address: content.address
      ? { "@type": "PostalAddress", streetAddress: content.address }
      : undefined,
    sameAs: [content.instagramUrl].filter(Boolean),
    currenciesAccepted: "TRY",
  };
}
