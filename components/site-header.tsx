"use client";

import { ChevronDown, MapPin, Search, ShoppingBag, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getPublicAssetUrl } from "@/lib/api";
import { cartCount, cartTotal } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { actions, useStore } from "@/lib/store";
import { useBranch, useConfig } from "./config-context";
import { Option } from "./ui";

function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  function submit(event: FormEvent) {
    event.preventDefault();
    const term = value.trim();
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/");
  }
  return (
    <form role="search" className={className} onSubmit={submit}>
      <label className="search">
        <Search aria-hidden />
        <span className="sr-only">Search the menu</span>
        <input type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Search the menu" enterKeyHint="search" />
      </label>
    </form>
  );
}

function BranchSelect() {
  const config = useConfig();
  const branch = useBranch();
  const { fulfilment } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const branches = config?.branches ?? [];
  const canDeliver = config?.delivery !== false;
  const canPickup = config?.selfPickup !== false;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!branch) return null;
  return (
    <div className="branch-select" ref={ref}>
      <button type="button" className="branch-select__button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>
        <MapPin aria-hidden />
        <span className="branch-select__text">
          <span className="branch-select__mode">{fulfilment === "take_away" ? "Pickup" : "Delivery"}</span>
          <span className="branch-select__name">{branch.name}</span>
        </span>
        <ChevronDown aria-hidden />
      </button>
      {open ? (
        <div className="popover" role="dialog" aria-label="Delivery or pickup">
          {canDeliver && canPickup ? (
            <div className="segmented" role="group" aria-label="Delivery or pickup">
              <button type="button" aria-pressed={fulfilment === "delivery"} onClick={() => actions.setFulfilment("delivery")}>Delivery</button>
              <button type="button" aria-pressed={fulfilment === "take_away"} onClick={() => actions.setFulfilment("take_away")}>Pickup</button>
            </div>
          ) : null}
          {branches.length > 1 ? (
            <div className="stack gap-sm">
              <p className="t-label-md">Branch</p>
              <div className="option-list">
                {branches.map((entry) => (
                  <Option key={entry.id} type="radio" name="branch" checked={entry.id === branch.id} title={entry.name} description={entry.address || undefined}
                    onChange={() => { actions.setBranch(entry.id); setOpen(false); }} />
                ))}
              </div>
              <p className="t-body-sm c-tertiary">Changing branch empties your cart, because menus and prices differ by branch.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SiteHeader() {
  const config = useConfig();
  const { cart, token } = useStore();
  const count = cartCount(cart);
  const logo = getPublicAssetUrl(config?.logoUrl ?? config?.logoPath, config?.baseUrls.restaurant_image_url);
  const name = config?.restaurantName ?? "Ismak Foods";
  const isHome = usePathname() === "/";
  return (
    <header className="site-header">
      <div className="container">
        <div className="site-header__bar">
          <Link href="/" className="site-header__logo" aria-label={`${name} menu`}>
            {logo ? <Image src={logo} alt={name} width={88} height={40} unoptimized priority /> : <span className="t-heading-sm">{name}</span>}
          </Link>
          <BranchSelect />
          {isHome ? <span className="site-header__spacer" /> : <SearchBox className="site-header__search site-header__search-desktop" />}
          <div className="site-header__actions">
            <Link href="/menu" className="btn btn--ghost site-header__orders">Menu</Link>
            <Link href={token ? "/account/orders" : "/sign-in?next=/account/orders"} className="btn btn--ghost site-header__orders">Orders</Link>
            <Link href={token ? "/account" : "/sign-in?next=/account"} className="icon-btn" aria-label={token ? "Your account" : "Sign in"}><User aria-hidden /></Link>
            <Link href="/cart" className="icon-btn site-header__cart-icon" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
              <ShoppingBag aria-hidden />
              {count ? <span className="count-dot" aria-hidden>{count}</span> : null}
            </Link>
            <button type="button" className="btn btn--primary cart-button" onClick={() => actions.openCart(true)} aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}, ${formatPrice(config, cartTotal(cart))}`}>
              <ShoppingBag aria-hidden />
              Cart{count ? ` · ${count}` : ""}
            </button>
          </div>
        </div>
        {isHome ? null : <SearchBox className="site-header__search site-header__search-mobile" />}
      </div>
    </header>
  );
}
