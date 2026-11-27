import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = { title: "Refund policy" };

export default function RefundsPage() {
  return (
    <StaticPage title="Refund policy">
      <h2>Cancelling an order</h2>
      <p>Contact the branch as soon as possible. Orders that have not started preparation can usually be cancelled.</p>
      <h2>Refunds</h2>
      <p>Approved refunds for mobile money and card payments are returned to the original payment method.</p>
      <h2>Problems with your order</h2>
      <p>If something is missing or wrong, call the branch with your order number and we will put it right.</p>
    </StaticPage>
  );
}
