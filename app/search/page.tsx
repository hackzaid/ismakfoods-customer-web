import type { Metadata } from "next";
import { SearchResults } from "@/components/menu-view";
import { getConfig, getServerMenu } from "@/lib/api";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const config = await getConfig().catch(() => null);
  const branchId = config?.branches[0]?.id ?? null;
  const menu = config ? await getServerMenu(config, branchId).catch(() => ({ categories: [], products: [] })) : { categories: [], products: [] };
  return <SearchResults initial={{ branchId, ...menu }} query={q} />;
}
