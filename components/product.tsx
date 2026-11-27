"use client";

import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Product } from "@/lib/api";
import { basePrice, lineUnitPrice, toggleSelection, validateSelections, type SelectionMap } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { actions } from "@/lib/store";
import { useConfig } from "./config-context";
import { Alert, Badge, Button, IconButton, Option, QuantityStepper } from "./ui";

function needsChoices(product: Product) {
  return product.variations.some((group) => group.required || group.min > 0);
}

export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const config = useConfig();
  const router = useRouter();
  const href = `/product/${product.id}`;
  const price = formatPrice(config, basePrice(product));
  const add = () => (needsChoices(product) ? router.push(href, { scroll: false }) : actions.addLine(product, {}, 1));
  const addButton = (extra: string) => (
    <IconButton icon={Plus} variant="secondary" label={`Add ${product.name}`} className={`product-card__add ${extra}`} onClick={add} />
  );
  return (
    <article className={["product-card", !product.available && "product-card--unavailable"].filter(Boolean).join(" ")}>
      <Link href={href} scroll={false} className="product-card__link" aria-label={`${product.name}, ${price}`} />
      <div className="product-card__body">
        <h3 className="product-card__name">{product.name}</h3>
        <p className="product-card__desc">{product.description}</p>
        <div className="product-card__footer">
          <span className="t-price-md">{price}</span>
          {product.discountPrice ? <s className="t-body-sm c-tertiary">{formatPrice(config, product.price)}</s> : null}
          {product.available ? addButton("") : <Badge>Sold out</Badge>}
        </div>
      </div>
      <div className="product-card__media">
        {product.imageUrl ? (
          <Image className="product-card__image" src={product.imageUrl} alt="" width={400} height={300} unoptimized priority={priority} />
        ) : <span className="product-card__image" />}
        {product.available ? addButton("") : null}
      </div>
    </article>
  );
}

/** Photo, description, option groups and add-to-cart. Used by the product page and the product dialog. */
export function ProductDetail({ product, onAdded }: { product: Product; onAdded: () => void }) {
  const config = useConfig();
  const [selections, setSelections] = useState<SelectionMap>({});
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const unit = lineUnitPrice({ product, selections });

  function add() {
    const problem = validateSelections(product, selections);
    if (problem) {
      setError(problem);
      return;
    }
    actions.addLine(product, selections, quantity);
    onAdded();
  }

  return (
    <>
      <div className="product-detail__body">
        <div className="stack gap-sm">
          <h1 className="t-heading-lg">{product.name}</h1>
          <p className="t-body-md c-secondary">{product.description}</p>
          <p className="t-price-lg">{formatPrice(config, basePrice(product))}</p>
        </div>
        {!product.available ? <Alert tone="warning" title="Sold out at this branch">Try another dish or check back later.</Alert> : null}
        {product.variations.map((group) => {
          const chosen = selections[group.id] ?? [];
          const rule = group.type === "single" ? "Select 1" : group.min > 0 ? `Select ${group.min} to ${group.max}` : `Select up to ${group.max}`;
          return (
            <fieldset className="option-group" key={group.id} style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="option-group__head">
                <legend className="stack gap-xs" style={{ padding: 0 }}>
                  <span className="t-heading-sm">{group.name}</span>
                  <span className="t-body-sm c-tertiary">{rule}</span>
                </legend>
                <Badge>{group.required ? "Required" : "Optional"}</Badge>
              </div>
              <div className="option-list">
                {group.values.map((option) => (
                  <Option
                    key={option.id}
                    type={group.type === "single" ? "radio" : "checkbox"}
                    name={`${product.id}-${group.id}`}
                    checked={chosen.some((entry) => entry.id === option.id)}
                    disabled={!product.available || (group.type === "multi" && chosen.length >= group.max && !chosen.some((entry) => entry.id === option.id))}
                    onChange={() => { setError(null); setSelections((current) => toggleSelection(current, group.id, option, group.type, group.max)); }}
                    title={option.name}
                    meta={option.price ? `+ ${formatPrice(config, option.price)}` : undefined}
                  />
                ))}
              </div>
            </fieldset>
          );
        })}
        {error ? <Alert tone="danger" title={error} /> : null}
      </div>
      <div className="action-bar">
        <QuantityStepper value={quantity} onChange={setQuantity} label={product.name} />
        <Button size="lg" onClick={add} disabled={!product.available}>Add to cart · {formatPrice(config, unit * quantity)}</Button>
      </div>
    </>
  );
}

export function ProductPhoto({ product }: { product: Product }) {
  return product.imageUrl
    ? <Image className="product-detail__photo" src={product.imageUrl} alt={product.name} width={800} height={600} unoptimized priority />
    : <div className="product-detail__photo" />;
}
