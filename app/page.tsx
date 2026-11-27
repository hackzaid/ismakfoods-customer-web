import { HomeView } from "@/components/home";
import { getConfig, getServerMenu } from "@/lib/api";

export default async function HomePage() {
  const config = await getConfig().catch(() => null);
  const branchId = config?.branches[0]?.id ?? null;
  const menu = config ? await getServerMenu(config, branchId).catch(() => ({ categories: [], products: [] })) : { categories: [], products: [] };
  return <HomeView initial={{ branchId, ...menu }} />;
}
