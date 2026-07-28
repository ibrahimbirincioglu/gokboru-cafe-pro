import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getPrisma } from "@/lib/db/prisma";
import { DEFAULT_PUBLIC_SITE, parsePublicSite } from "./content";

export const PUBLIC_SITE_KEY = "public-site";

const loadPublicSiteContent = unstable_cache(async function loadPublicSiteContent() {
  const setting = await getPrisma().appSetting.findUnique({
    where: { key: PUBLIC_SITE_KEY },
    select: { valueJson: true },
  });
  return setting ? parsePublicSite(setting.valueJson) : DEFAULT_PUBLIC_SITE;
}, [PUBLIC_SITE_KEY], { revalidate: 300, tags: [PUBLIC_SITE_KEY] });

export const getPublicSiteContent = cache(loadPublicSiteContent);

export async function getFeaturedProducts() {
  const prisma = getPrisma();
  const featured = await prisma.product.findMany({
    where: {
      isActive: true,
      isAvailable: true,
      category: { isActive: true },
      isFeatured: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 6,
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      price: true,
      discountPrice: true,
      category: { select: { name: true } },
    },
  });
  if (featured.length) return featured;
  return prisma.product.findMany({
    where: { isActive: true, isAvailable: true, category: { isActive: true } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 6,
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      price: true,
      discountPrice: true,
      category: { select: { name: true } },
    },
  });
}
