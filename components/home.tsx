"use client";

import { Bike, ChefHat, Search, Store, UtensilsCrossed, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { MobileCartBar } from "./cart";
import { useConfig } from "./config-context";
import { groupByCategory, useMenu, type MenuData } from "./menu-data";
import { ProductCard } from "./product";
import { ButtonLink } from "./ui";

/** Shortens long API category names for the round bubbles ("Burgers & Sandwiches" -> "Burgers"). */
function shortName(name: string) {
  return name.split(/\s*(?:&|,| and )\s*/i)[0];
}

const GROW: { href: string; icon: LucideIcon; title: string; body: string; cta: string }[] = [
  { href: "/riders", icon: Bike, title: "Become a rider", body: "Flexible hours delivering across Kampala.", cta: "Apply to ride" },
  { href: "/catering", icon: UtensilsCrossed, title: "Catering and events", body: "Platters and set menus for offices, parties and events.", cta: "Plan an order" },
  { href: "/careers", icon: ChefHat, title: "Careers", body: "Kitchen and branch roles for people who love food and service.", cta: "See open roles" },
  { href: "/contact", icon: Store, title: "Visit our branches", body: "", cta: "Find a branch" }
];

function HeroSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const term = value.trim();
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/menu");
  }
  return (
    <form role="search" className="hero-search" onSubmit={submit}>
      <label className="hero-search__field">
        <Search aria-hidden />
        <span className="sr-only">Search the menu</span>
        <input type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder="What are you craving?" enterKeyHint="search" />
      </label>
      <button type="submit" className="hero-search__button">Search</button>
    </form>
  );
}

export function HomeView({ initial }: { initial: MenuData }) {
  const config = useConfig();
  const { categories, products } = useMenu(initial);
  const groups = useMemo(() => groupByCategory(categories, products), [categories, products]);
  const bubbles = groups.filter((group) => group.category.id && group.category.imageUrl).slice(0, 8);
  const available = products.filter((product) => product.available);
  const recommended = (available.some((product) => product.recommended) ? available.filter((product) => product.recommended) : available).slice(0, 4);
  const branches = config?.branches ?? [];
  const branchNames = branches.map((branch) => branch.name);
  const where = branchNames.length > 1 ? `${branchNames.slice(0, -1).join(", ")} and ${branchNames[branchNames.length - 1]}` : branchNames[0];

  return (
    <div className="has-cart-bar">
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero__inner">
          <div className="hero__heading">
            <h1 id="hero-title" className="hero__title">Fresh and fast, from our kitchen to your door</h1>
            {where ? <p className="hero__subtitle">Delivery and pickup from {where}</p> : null}
          </div>
          {bubbles.length ? (
            <nav className="bubbles" aria-label="Browse by category">
              {bubbles.map(({ category }) => (
                <Link key={category.id} href={`/menu#category-${category.id}`} className="bubble">
                  <Image className="bubble__photo" src={category.imageUrl!} alt="" width={112} height={112} unoptimized />
                  <span className="bubble__label">{shortName(category.name)}</span>
                </Link>
              ))}
            </nav>
          ) : null}
          <HeroSearch />
        </div>
      </section>

      {recommended.length ? (
        <section className="container home-section" aria-labelledby="recommended-title">
          <div className="home-section__head">
            <div className="stack gap-xs">
              <h2 id="recommended-title" className="t-heading-lg">Recommended by our kitchen</h2>
              <p className="c-secondary">Dishes our chefs pick for today</p>
            </div>
            <ButtonLink href="/menu" variant="secondary">See the full menu</ButtonLink>
          </div>
          <div className="product-grid">
            {recommended.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 2} />)}
          </div>
        </section>
      ) : null}

      <section className="grow" aria-labelledby="grow-title">
        <div className="container">
          <div className="grow__head">
            <h2 id="grow-title" className="t-heading-xl">Grow with Ismak Foods</h2>
            <p className="t-body-lg c-secondary">Ride with us, cater your next event, join the kitchen, or come and see us.</p>
          </div>
          <div className="grow__grid">
            {GROW.map((item) => (
              <Link key={item.href} href={item.href} className="grow-card">
                <span className="grow-card__icon"><item.icon aria-hidden /></span>
                <span className="grow-card__text">
                  <span className="grow-card__title">{item.title}</span>
                  <span className="grow-card__body">{item.body || (where ? `${where}, open daily.` : "Find your nearest branch.")}</span>
                  <span className="grow-card__cta">{item.cta}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <MobileCartBar />
    </div>
  );
}
