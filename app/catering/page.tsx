import type { Metadata } from "next";
import { JoinPage } from "@/components/join-page";

export const metadata: Metadata = { title: "Catering and events" };

export default function CateringPage() {
  return (
    <JoinPage
      title="Catering and events"
      subject="Catering enquiry"
      intro="Feeding a team, a party or an event? We prepare platters and larger orders from our menu."
      sections={[
        { heading: "Tell us about your event", body: "Let us know the date, the number of guests, where it is, and any dietary needs. We will suggest dishes and confirm the price." },
        { heading: "Give us notice", body: "For large orders, contact us a few days ahead so the kitchen can plan." }
      ]}
    />
  );
}
