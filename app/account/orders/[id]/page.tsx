import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderDetailView } from "@/components/account";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="page page--subtle" />}>
      <OrderDetailView orderId={Number(id)} />
    </Suspense>
  );
}
