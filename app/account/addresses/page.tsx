import type { Metadata } from "next";
import { AddressesView } from "@/components/account";

export const metadata: Metadata = { title: "Saved addresses", robots: { index: false } };

export default function AddressesPage() {
  return <AddressesView />;
}
