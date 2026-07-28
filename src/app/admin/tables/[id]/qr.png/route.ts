import { qrPng } from "@/features/qr/image";
import { qrPublicUrl, tokenFromEncrypted } from "@/features/qr/server";
import { tableIdSchema } from "@/features/qr/validation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireServerPermission } from "@/lib/auth/server";
import { getPrisma } from "@/lib/db/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireServerPermission(PERMISSIONS.TABLES_MANAGE);
  const id = tableIdSchema.parse((await params).id);
  const table = await getPrisma().table.findUnique({
    where: { id },
    select: { number: true, qrTokenEncrypted: true },
  });
  if (!table?.qrTokenEncrypted) {
    return new Response("QR kodu bulunamadı.", { status: 404 });
  }
  const token = tokenFromEncrypted(table.qrTokenEncrypted);
  const png = await qrPng(qrPublicUrl(token));
  return new Response(new Uint8Array(png), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="masa-${table.number}-qr.png"`,
      "Content-Type": "image/png",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
