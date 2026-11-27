"use client";

import { SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { pluralize } from "@/lib/format";
import { MobileCartBar } from "./cart";
import { useBranch } from "./config-context";
import { groupByCategory, useMenu, type MenuData } from "./menu-data";
import { ProductCard } from "./product";
import { Alert, ButtonLink } from "./ui";

function slug(id: number) {
  return `category-${id}`;
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!ids.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-160px 0px -60% 0px" }
    );
    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active ?? ids[0] ?? null;
}

export function MenuView({ initial }: { initial: MenuData }) {
  const branch = useBranch();
  const { categories, products, loading, error } = useMenu(initial);
  const groups = useMemo(() => groupByCategory(categories, products), [categories, products]);
  const ids = useMemo(() => groups.map((group) => slug(group.category.id)), [groups]);
  const active = useActiveSection(ids);

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="page has-cart-bar">
      <div className="container page-head">
        <h1 className="t-heading-xl">Menu</h1>
        {branch ? <p className="t-body-lg c-secondary">Ordering from {branch.name}{branch.address ? ` · ${branch.address}` : ""}</p> : null}
      </div>

      {groups.length ? (
        <nav className="category-bar" aria-label="Menu categories">
          <div className="container category-bar__scroll">
            {groups.map((group) => {
              const id = slug(group.category.id);
              return (
                <button key={id} type="button" className="category-tab" aria-current={active === id ? "true" : undefined} onClick={() => jump(id)}>
                  {group.category.name}
                </button>
              );
            })}
          </div>
        </nav>
      ) : null}

      <div className="container" aria-busy={loading || undefined}>
        {error ? <div style={{ paddingTop: 24 }}><Alert tone="danger" title="Menu unavailable">{error}</Alert></div> : null}
        {loading ? (
          <div className="product-grid" style={{ paddingTop: 24 }}>
            {Array.from({ length: 8 }, (_, index) => <div key={index} className="skeleton" style={{ height: 128 }} />)}
          </div>
        ) : null}
        {!loading && !error && !groups.length ? (
          <div className="empty">
            <SearchX aria-hidden />
            <p className="t-heading-sm">No dishes available right now</p>
            <p className="c-secondary">This branch has not published its menu yet. Try another branch.</p>
          </div>
        ) : null}
        {!loading ? groups.map((group, groupIndex) => (
          <section key={group.category.id} id={slug(group.category.id)} className="menu-section" aria-labelledby={`${slug(group.category.id)}-title`}>
            <div className="menu-section__head">
              <h2 className="t-heading-lg" id={`${slug(group.category.id)}-title`}>{group.category.name}</h2>
              <span className="t-body-md c-tertiary">{pluralize(group.products.length, "item")}</span>
            </div>
            <div className="product-grid">
              {group.products.map((product, index) => <ProductCard key={product.id} product={product} priority={groupIndex === 0 && index < 4} />)}
            </div>
          </section>
        )) : null}
      </div>
      <MobileCartBar />
    </div>
  );
}

export function SearchResults({ initial, query }: { initial: MenuData; query: string }) {
  const { products, loading } = useMenu(initial);
  const term = query.trim().toLowerCase();
  const results = term ? products.filter((product) => `${product.name} ${product.description}`.toLowerCase().includes(term)) : [];
  return (
    <div className="page has-cart-bar">
      <div className="container page-head">
        <h1 className="t-heading-xl">{term ? `Results for “${query}”` : "Search the menu"}</h1>
        {term && !loading ? <p className="t-body-lg c-secondary">{pluralize(results.length, "dish", "dishes")} found</p> : null}
      </div>
      <div className="container">
        {results.length ? (
          <div className="product-grid">{results.map((product) => <ProductCard key={product.id} product={product} />)}</div>
        ) : !loading ? (
          <div className="empty">
            <SearchX aria-hidden />
            <p className="t-heading-sm">No dishes match your search</p>
            <p className="c-secondary">Check the spelling or browse the full menu.</p>
            <ButtonLink href="/menu" variant="secondary">Back to the menu</ButtonLink>
          </div>
        ) : null}
      </div>
      <MobileCartBar />
    </div>
  );
}
