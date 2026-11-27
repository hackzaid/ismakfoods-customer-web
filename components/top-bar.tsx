"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { IconButton } from "./ui";

/** Mobile-only bar for task pages (cart, checkout, sign-in, account). Hidden on desktop by CSS. */
export function TopBar({ title, backHref }: { title: string; backHref?: string }) {
  const router = useRouter();
  return (
    <div className="top-bar">
      <IconButton icon={ArrowLeft} label="Back" onClick={() => (backHref ? router.push(backHref) : router.back())} />
      <h1 className="t-heading-sm">{title}</h1>
    </div>
  );
}
