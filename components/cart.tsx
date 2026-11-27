"use client";

import { CheckCircle2, ShoppingBag, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cartCount, cartTotal, lineUnitPrice, selectionSummary, type CartLine } from "@/lib/cart";
import { formatPrice, pluralize } from "@/lib/format";
import { actions, useStore } from "@/lib/store";
import { useConfig } from "./config-context";
import { ButtonLink, IconButton, QuantityStepper } from "./ui";

export function CartLineItem({ line, readOnly }: { line: CartLine; readOnly?: boolean }) {
  const config = useConfig();
  const options = selectionSummary(line.selections);
  return (
    <div className="cart-line">
      {line.product.imageUrl ? <Image className="cart-line__image" src={line.product.imageUrl} alt="" width={64} height={64} unoptimized /> : <span className="cart-line__image" />}
      <div className="cart-line__body">
        <div className="cart-line__top">
          <p className="t-body-md t-strong">{readOnly ? `${line.quantity} × ` : ""}{line.product.name}</p>
          <p className="t-body-md t-strong">{formatPrice(config, lineUnitPrice(line) * line.quantity)}</p>
        </div>
        {options ? <p className="t-body-sm c-secondary">{options}</p> : null}
        {readOnly ? null : (
          <div className="cart-line__controls">
            <QuantityStepper size="sm" value={line.quantity} label={line.product.name} onChange={(value) => actions.setQuantity(line.key, value)} />
            <IconButton icon={Trash2} label={`Remove ${line.product.name}`} onClick={() => actions.removeLine(line.key)} />
          </div>
        )}
      </div>
    </div>
  );
}

export function OrderSummary({ count, subtotal, delivery, total }: { count: number; subtotal: number; delivery: string; total: number }) {
  const config = useConfig();
  return (
    <section className="summary" aria-label="Order summary">
      <h2 className="t-heading-sm">Order summary</h2>
      <dl>
        <div className="summary__row"><dt>Subtotal ({pluralize(count, "item")})</dt><dd>{formatPrice(config, subtotal)}</dd></div>
        <div className="summary__row"><dt>Delivery</dt><dd>{delivery}</dd></div>
      </dl>
      <div className="summary__divider" />
      <div className="summary__total"><span>Total</span><span className="t-price-lg">{formatPrice(config, total)}</span></div>
    </section>
  );
}

export function EmptyCart() {
  return (
    <div className="empty">
      <ShoppingBag aria-hidden />
      <p className="t-heading-sm">Your cart is empty</p>
      <p className="c-secondary">Add something from the menu to get started.</p>
      <ButtonLink href="/menu" variant="secondary">Browse the menu</ButtonLink>
    </div>
  );
}

export function CartDrawer() {
  const config = useConfig();
  const { cart, cartOpen } = useStore();
  const pathname = usePathname();
  const count = cartCount(cart);
  const subtotal = cartTotal(cart);

  useEffect(() => { actions.openCart(false); }, [pathname]);
  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && actions.openCart(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [cartOpen]);

  if (!cartOpen) return null;
  return (
    <>
      <div className="drawer-scrim" onClick={() => actions.openCart(false)} aria-hidden />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Your cart">
        <div className="drawer__head">
          <h2 className="t-heading-md">Your cart{count ? ` (${count})` : ""}</h2>
          <IconButton icon={X} label="Close cart" onClick={() => actions.openCart(false)} autoFocus />
        </div>
        <div className="drawer__body">
          {cart.length ? (
            <>
              <div>{cart.map((line) => <CartLineItem key={line.key} line={line} />)}</div>
              <OrderSummary count={count} subtotal={subtotal} delivery="Calculated at checkout" total={subtotal} />
            </>
          ) : <EmptyCart />}
        </div>
        {cart.length ? (
          <div className="drawer__foot">
            <ButtonLink href="/checkout" size="lg" block>Go to checkout · {formatPrice(config, subtotal)}</ButtonLink>
          </div>
        ) : null}
      </aside>
    </>
  );
}

/** Sticky bottom bar on phones while browsing, once the cart has items. */
export function MobileCartBar() {
  const config = useConfig();
  const { cart } = useStore();
  const count = cartCount(cart);
  if (!count) return null;
  return (
    <div className="mobile-cart-bar">
      <Link href="/cart" className="btn btn--primary btn--lg btn--block btn--split">
        <span className="row"><ShoppingBag aria-hidden /> View cart · {pluralize(count, "item")}</span>
        <span className="t-price-md">{formatPrice(config, cartTotal(cart))}</span>
      </Link>
    </div>
  );
}

export function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      <CheckCircle2 aria-hidden />
      <span>{toast.message}</span>
      <Link href="/cart" className="text-link">View cart</Link>
    </div>
  );
}
