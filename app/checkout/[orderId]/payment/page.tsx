import type { Metadata } from "next";
import { PaymentStatusView } from "@/components/checkout";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

export default async function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <PaymentStatusView orderId={Number(orderId)} />;
}
