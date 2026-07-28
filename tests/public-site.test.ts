import { readFileSync } from "node:fs";
import { join } from "node:path";
import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildLocalBusinessJsonLd,
  DEFAULT_PUBLIC_SITE,
  parsePublicSite,
  publicSiteSchema,
  safeExternalUrl,
} from "../src/features/public-site/content";
import { hasPermission, PERMISSIONS } from "../src/lib/auth/permissions";

describe("public site content security", () => {
  it("accepts managed HTTPS media and rejects unsafe or untrusted embeds", () => {
    expect(
      publicSiteSchema.parse({
        ...DEFAULT_PUBLIC_SITE,
        heroImageUrl: "https://cdn.example.com/cafe.webp",
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=safe",
        instagramUrl: "https://instagram.com/gokborucafe",
      }).heroImageUrl,
    ).toBe("https://cdn.example.com/cafe.webp");
    expect(() =>
      publicSiteSchema.parse({
        ...DEFAULT_PUBLIC_SITE,
        heroImageUrl: "http://example.com/insecure.jpg",
      }),
    ).toThrow();
    expect(() =>
      publicSiteSchema.parse({
        ...DEFAULT_PUBLIC_SITE,
        mapEmbedUrl: "https://attacker.example/embed",
      }),
    ).toThrow();
    expect(() => safeExternalUrl("javascript:alert(1)")).toThrow();
  });

  it("falls back atomically when stored JSON is incomplete", () => {
    expect(parsePublicSite({ heroTitle: "Eksik" })).toEqual(DEFAULT_PUBLIC_SITE);
  });

  it("builds LocalBusiness data without inventing missing contact details", () => {
    const data = buildLocalBusinessJsonLd(
      {
        ...DEFAULT_PUBLIC_SITE,
        address: "Örnek Mahallesi",
        phone: "+90 555 000 00 00",
        instagramUrl: "https://instagram.com/gokborucafe",
      },
      "https://gokborucafe.com/",
    );
    expect(data).toMatchObject({
      "@type": "CafeOrCoffeeShop",
      url: "https://gokborucafe.com/",
      telephone: "+90 555 000 00 00",
      address: { "@type": "PostalAddress", streetAddress: "Örnek Mahallesi" },
    });
  });
});

describe("public site authorization and accessibility", () => {
  it("allows only OWNER and ADMIN to manage public content", () => {
    expect(hasPermission(UserRole.OWNER, PERMISSIONS.SITE_MANAGE)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, PERMISSIONS.SITE_MANAGE)).toBe(true);
    expect(hasPermission(UserRole.CASHIER, PERMISSIONS.SITE_MANAGE)).toBe(false);
    expect(hasPermission(UserRole.WAITER, PERMISSIONS.SITE_MANAGE)).toBe(false);
  });

  it("keeps required landmarks, skip navigation, lazy gallery, SEO and reduced motion", () => {
    const page = readFileSync(join(process.cwd(), "src", "app", "page.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
    expect(page).toContain('href="#ana-icerik"');
    expect(page).toContain('<nav aria-label="Ana menü">');
    expect(page).toContain('loading="lazy"');
    expect(page).toContain('type="application/ld+json"');
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
