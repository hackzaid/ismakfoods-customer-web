import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <StaticPage title="Terms of service">
      <h2>Ordering</h2>
      <p>Orders are placed with the branch you select. The prices and availability shown at checkout apply to that order.</p>
      <h2>Payment</h2>
      <p>You can pay by mobile money, card or cash on delivery where the branch offers it. Mobile money and card payments are confirmed by the payment provider before your order is prepared.</p>
      <h2>Delivery and pickup</h2>
      <p>Delivery times are estimates. For pickup, collect your order from the branch counter and give your order number.</p>
      <h2>Cancellations and refunds</h2>
      <p>See the refund policy for when an order can be cancelled and how refunds are returned.</p>
    </StaticPage>
  );
}
