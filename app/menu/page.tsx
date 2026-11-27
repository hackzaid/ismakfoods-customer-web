import { MenuView } from "@/components/menu-view";
import { getConfig, getServerMenu } from "@/lib/api";

export default async function MenuRoute() {
  const config = await getConfig().catch(() => null);
  const branchId = config?.branches[0]?.id ?? null;
  const menu = config ? await getServerMenu(config, branchId).catch(() => ({ categories: [], products: [] })) : { categories: [], products: [] };
  return <MenuView initial={{ branchId, ...menu }} />;
}
