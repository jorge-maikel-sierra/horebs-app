import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { restauranteJsonLd, jsonLdScript } from "@/lib/json-ld";

export const metadata: Metadata = {
  metadataBase: new URL("https://pizzeriahorebs.shop"),
  title: "Pizzería Horebs",
  description: "Pide en línea — Pizzería Horebs, Riohacha",
  alternates: { canonical: "/" },
  openGraph: {
    siteName: "Pizzería Horebs",
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(restauranteJsonLd()) }}
        />
        <CartProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
