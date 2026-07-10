import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { getConfig, getPublicAssetUrl } from "@/lib/api";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display"
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await getConfig().catch(() => null);
  const title = config?.restaurantName ?? "Ismak Foods";
  const icon = getPublicAssetUrl(config?.faviconUrl ?? config?.faviconPath, config?.baseUrls.restaurant_image_url);

  return {
    title,
    description: "Browse, checkout, and track Ismak Foods orders.",
    icons: icon ? { icon } : undefined
  };
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={plusJakarta.variable}>{children}</body>
    </html>
  );
}
