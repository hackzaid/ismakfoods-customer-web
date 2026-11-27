"use client";

import { useEffect, useState } from "react";
import { fetchCategories, fetchMenu, type Category, type Product } from "@/lib/api";
import { useBranch, useConfig } from "./config-context";

export type MenuData = { branchId: number | null; categories: Category[]; products: Product[] };

/**
 * Starts from the server-rendered menu (default branch) and refetches in the browser
 * only when the customer has chosen a different branch.
 */
export function useMenu(initial: MenuData) {
  const config = useConfig();
  const branch = useBranch();
  const wanted = branch?.id ?? initial.branchId;
  const [data, setData] = useState<MenuData>(initial);
  const [error, setError] = useState<string | null>(null);
  const loading = wanted !== data.branchId && !error;

  useEffect(() => {
    if (!config || wanted === data.branchId) return;
    let alive = true;
    Promise.all([fetchCategories(wanted, config.baseUrls.category_image_url), fetchMenu(config, wanted)])
      .then(([categories, products]) => alive && setData({ branchId: wanted, categories, products }))
      .catch(() => alive && setError("The menu could not be loaded. Check your connection and refresh the page."));
    return () => { alive = false; };
  }, [config, wanted, data.branchId]);

  return { ...data, loading, error };
}

/** Groups products under the API's categories, in category priority order, dropping empty ones. */
export function groupByCategory(categories: Category[], products: Product[]) {
  const groups = categories
    .map((category) => ({ category, products: products.filter((product) => product.categoryIds.includes(category.id)) }))
    .filter((group) => group.products.length);
  const placed = new Set(groups.flatMap((group) => group.products.map((product) => product.id)));
  const rest = products.filter((product) => !placed.has(product.id));
  if (rest.length) groups.push({ category: { id: 0, name: "More dishes", priority: 999 }, products: rest });
  return groups;
}
