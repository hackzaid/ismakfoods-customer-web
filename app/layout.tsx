import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { CartDrawer, Toast } from "@/components/cart";
import { ConfigProvider } from "@/components/config-context";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getConfig, getPublicAssetUrl } from "@/lib/api";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display"
});

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export async function generateMetadata(): Promise<Metadata> {
  const config = await getConfig().catch(() => null);
  const name = config?.restaurantName ?? "Ismak Foods";
  const icon = getPublicAssetUrl(config?.faviconUrl ?? config?.faviconPath, config?.baseUrls.restaurant_image_url);
  return {
    title: { default: `${name} · Order online`, template: `%s · ${name}` },
    description: `Order from the ${name} menu for delivery or pickup in Kampala. Pay by mobile money, card or cash.`,
    icons: icon ? { icon } : undefined
  };
}

export default async function RootLayout({ children, modal }: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  const config = await getConfig().catch(() => null);
  return (
    <html lang="en">
      <body className={plusJakarta.variable}>
        <ConfigProvider config={config}>
          <Suspense fallback={<div className="site-header" style={{ height: 108 }} />}>
            <SiteHeader />
          </Suspense>
          <main>
            {config?.maintenance ? (
              <div className="empty" style={{ padding: "120px 16px 160px" }}>
                <h1 className="t-heading-xl">Online ordering is paused</h1>
                <p className="t-body-lg c-secondary">We are updating the website and will be back shortly.{config.phone ? ` You can still order by calling ${config.phone}.` : ""}</p>
              </div>
            ) : children}
          </main>
          <SiteFooter config={config} />
          {modal}
          <CartDrawer />
          <Toast />
        </ConfigProvider>
      </body>
    </html>
  );
}
