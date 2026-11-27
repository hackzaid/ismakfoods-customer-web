import type { Metadata } from "next";
import { AccountView } from "@/components/account";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default function AccountPage() {
  return <AccountView />;
}
