import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInView } from "@/components/auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="page page--subtle" />}>
      <SignInView />
    </Suspense>
  );
}
