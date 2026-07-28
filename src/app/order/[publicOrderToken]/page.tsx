import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderTracker } from "@/components/orders/order-tracker";
import { getPublicOrderTracking } from "@/features/orders/tracking";

export const metadata: Metadata = { title: "Sipariş Takibi" };
export const dynamic = "force-dynamic";

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ publicOrderToken: string }>;
}) {
  const { publicOrderToken } = await params;
  const order = await getPublicOrderTracking(publicOrderToken);
  if (!order) notFound();
  return (
    <main className="page-shell">
      <section className="hero">
        <OrderTracker initialOrder={order} publicToken={publicOrderToken} />
      </section>
    </main>
  );
}
