import type { Metadata } from "next";
import { ProductPageView } from "@/components/product-views";
import { getConfig, getServerMenu } from "@/lib/api";

async function load(id: number) {
  const config = await getConfig().catch(() => null);
  const branchId = config?.branches[0]?.id ?? null;
  const menu = config ? await getServerMenu(config, branchId).catch(() => ({ categories: [], products: [] })) : { categories: [], products: [] };
  return { branchId, ...menu, product: menu.products.find((entry) => entry.id === id) ?? null };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { product } = await load(Number((await params).id));
  return product ? { title: product.name, description: product.description } : { title: "Dish not found" };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { branchId, categories, products } = await load(id);
  return <ProductPageView initial={{ branchId, categories, products }} id={id} />;
}
