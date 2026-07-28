"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { formToPublicSite } from "@/features/public-site/content";
import { PUBLIC_SITE_KEY } from "@/features/public-site/server";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireServerPermission } from "@/lib/auth/server";
import { getPrisma } from "@/lib/db/prisma";

export async function updatePublicSiteAction(formData: FormData) {
  const auth = await requireServerPermission(PERMISSIONS.SITE_MANAGE);
  try {
    const content = formToPublicSite(formData);
    const valueJson = content as Prisma.InputJsonValue;
    await getPrisma().$transaction(async (tx) => {
      const before = await tx.appSetting.findUnique({
        where: { key: PUBLIC_SITE_KEY },
        select: { valueJson: true },
      });
      await tx.appSetting.upsert({
        where: { key: PUBLIC_SITE_KEY },
        update: { valueJson, updatedByUserId: auth.user.id },
        create: {
          key: PUBLIC_SITE_KEY,
          valueJson,
          updatedByUserId: auth.user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: auth.user.id,
          action: "PUBLIC_SITE_CONTENT_UPDATED",
          entityType: "AppSetting",
          entityId: PUBLIC_SITE_KEY,
          beforeJson:
            before?.valueJson === null
              ? Prisma.JsonNull
              : (before?.valueJson as Prisma.InputJsonValue | undefined),
          afterJson: valueJson,
          safeMetadata: { section: "public-site" },
        },
      });
    });
  } catch {
    redirect("/admin/site?error=invalid");
  }
  revalidatePath("/");
  updateTag(PUBLIC_SITE_KEY);
  revalidatePath("/admin/site");
  revalidatePath("/sitemap.xml");
  redirect("/admin/site?saved=1");
}
