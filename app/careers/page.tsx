import type { Metadata } from "next";
import { JoinPage } from "@/components/join-page";

export const metadata: Metadata = { title: "Careers" };

export default function CareersPage() {
  return (
    <JoinPage
      title="Careers"
      subject="Job application"
      intro="We hire for our kitchens and branches: cooks, kitchen assistants, cashiers and front-of-house staff."
      sections={[
        { heading: "How to apply", body: "Send your CV and the role you are interested in. We will contact you when a suitable position opens." }
      ]}
    />
  );
}
