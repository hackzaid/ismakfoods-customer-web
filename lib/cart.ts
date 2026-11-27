import type { CartLinePayload, Product, ProductOption } from "./api";

export type SelectionMap = Record<string, ProductOption[]>;

export type CartLine = {
  key: string;
  product: Product;
  quantity: number;
  selections: SelectionMap;
};

export function optionsTotal(selections: SelectionMap) {
  return Object.values(selections).flat().reduce((sum, option) => sum + option.price, 0);
}

export function basePrice(product: Product) {
  return product.discountPrice ?? product.price;
}

export function lineUnitPrice(line: Pick<CartLine, "product" | "selections">) {
  return basePrice(line.product) + optionsTotal(line.selections);
}

export function cartTotal(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + lineUnitPrice(line) * line.quantity, 0);
}

export function cartCount(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** One readable line such as "Double patty, Extra cheese". */
export function selectionSummary(selections: SelectionMap) {
  return Object.values(selections).flat().map((option) => option.name).join(", ");
}

function selectedVariationPayload(product: Product, selections: SelectionMap) {
  return product.variations
    .filter((group) => group.values.some((option) => option.source !== "add_on"))
    .map((group) => {
      const selected = (selections[group.id] ?? []).filter((option) => option.source !== "add_on");
      return {
        id: group.id,
        name: group.name,
        type: group.type,
        required: group.required,
        min: group.min,
        max: group.max,
        values: selected.map((option) => ({
          id: option.id,
          label: option.name,
          name: option.name,
          price: option.price,
          option_price: option.price,
          optionPrice: option.price
        }))
      };
    })
    .filter((group) => group.values.length);
}

function selectedAddOns(product: Product, selections: SelectionMap) {
  return product.variations.flatMap((group) =>
    (selections[group.id] ?? [])
      .filter((option) => option.source === "add_on" && option.addOnId)
      .map((option) => option.addOnId as number)
  );
}

export function validateSelections(product: Product, selections: SelectionMap): string | null {
  for (const group of product.variations) {
    const count = selections[group.id]?.length ?? 0;
    if (group.required && count < Math.max(1, group.min)) return `Choose an option for ${group.name}.`;
    if (count < group.min) return `Choose at least ${group.min} for ${group.name}.`;
    if (count > group.max) return `Choose up to ${group.max} for ${group.name}.`;
  }
  return null;
}

export function cartPayload(lines: CartLine[]): CartLinePayload[] {
  return lines.map((line) => {
    const addOnIds = selectedAddOns(line.product, line.selections);
    return {
      product_id: line.product.id,
      quantity: line.quantity,
      variant: [],
      variations: selectedVariationPayload(line.product, line.selections),
      add_on_ids: addOnIds,
      add_on_qtys: addOnIds.map(() => 1)
    };
  });
}

export function selectionKey(product: Product, selections: SelectionMap) {
  return `${product.id}:${JSON.stringify({
    variations: selectedVariationPayload(product, selections),
    addOns: selectedAddOns(product, selections)
  })}`;
}

/** Toggle an option inside its group, respecting single/multi selection and the group's max. */
export function toggleSelection(selections: SelectionMap, groupId: string, option: ProductOption, type: "single" | "multi", max: number): SelectionMap {
  const current = selections[groupId] ?? [];
  const exists = current.some((entry) => entry.id === option.id);
  if (type === "single") return { ...selections, [groupId]: [option] };
  if (exists) return { ...selections, [groupId]: current.filter((entry) => entry.id !== option.id) };
  if (current.length >= max) return selections;
  return { ...selections, [groupId]: [...current, option] };
}
