import type { Metadata } from "next";
import { JoinPage } from "@/components/join-page";

export const metadata: Metadata = { title: "Become a rider" };

export default function RidersPage() {
  return (
    <JoinPage
      title="Become a rider"
      subject="Rider application"
      intro="We deliver Ismak Foods orders across Kampala and are looking for reliable riders."
      sections={[
        { heading: "What you need", body: "A valid riding permit, a smartphone, and a good knowledge of Kampala's roads." },
        { heading: "How it works", body: "Riders collect orders from our branches and deliver them to customers. We will explain shifts and pay when we talk." }
      ]}
    />
  );
}
