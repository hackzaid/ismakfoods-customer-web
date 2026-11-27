import { ProductDialog } from "@/components/product-views";
import { getConfig, getServerMenu } from "@/lib/api";

/** Opening a dish from the menu shows it in a dialog; a direct link renders the full product page instead. */
export default async function ProductModal({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const config = await getConfig().catch(() => null);
  const branchId = config?.branches[0]?.id ?? null;
  const menu = config ? await getServerMenu(config, branchId).catch(() => ({ categories: [], products: [] })) : { categories: [], products: [] };
  return <ProductDialog initial={{ branchId, ...menu }} id={id} />;
}
