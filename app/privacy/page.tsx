import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy policy">
      <h2>What we collect</h2>
      <p>Your name, phone number, email address, delivery addresses and order history, so we can prepare and deliver your orders.</p>
      <h2>How we use it</h2>
      <p>To process orders and payments, send order updates, and help when you contact us. We do not sell your information.</p>
      <h2>Your choices</h2>
      <p>You can ask us to update or delete your account information at any time by contacting a branch.</p>
    </StaticPage>
  );
}
