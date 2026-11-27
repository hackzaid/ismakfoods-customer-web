"use client";

import { ArrowLeft, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMenu, type MenuData } from "./menu-data";
import { ProductDetail, ProductPhoto } from "./product";
import { ButtonLink, IconButton } from "./ui";

function useProduct(initial: MenuData, id: number) {
  const { products, loading } = useMenu(initial);
  return { product: products.find((entry) => entry.id === id) ?? null, loading };
}

function NotFound() {
  return (
    <div className="empty">
      <p className="t-heading-sm">This dish is not on the menu</p>
      <p className="c-secondary">It may have been removed or is not offered at this branch.</p>
      <ButtonLink href="/menu" variant="secondary">Back to the menu</ButtonLink>
    </div>
  );
}

export function ProductPageView({ initial, id }: { initial: MenuData; id: number }) {
  const router = useRouter();
  const { product, loading } = useProduct(initial, id);
  if (loading) return <div className="container"><div className="skeleton" style={{ height: 320, marginTop: 24 }} /></div>;
  if (!product) return <div className="container"><NotFound /></div>;
  return (
    <div className="product-page product-detail">
      <div style={{ position: "relative" }}>
        <ProductPhoto product={product} />
        <IconButton icon={ArrowLeft} variant="secondary" label="Back to the menu" className="dialog__close" style={{ left: 16, right: "auto" }} onClick={() => router.push("/menu")} />
      </div>
      <div className="stack">
        <ProductDetail product={product} onAdded={() => router.push("/menu")} />
      </div>
    </div>
  );
}

export function ProductDialog({ initial, id }: { initial: MenuData; id: number }) {
  const router = useRouter();
  const { product, loading } = useProduct(initial, id);
  const close = () => router.back();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && router.back();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [router]);

  return (
    <div className="scrim" onClick={(event) => event.target === event.currentTarget && close()}>
      <div className="dialog dialog--product" role="dialog" aria-modal="true" aria-label={product?.name ?? "Dish"}>
        <IconButton icon={X} variant="secondary" label="Close" className="dialog__close" onClick={close} autoFocus />
        {loading ? <div className="skeleton" style={{ height: 320, margin: 24, flex: 1 }} /> : !product ? <NotFound /> : (
          <>
            <ProductPhoto product={product} />
            <div className="dialog__panel">
              <div className="dialog__scroll">
                <ProductDetail product={product} onAdded={close} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
