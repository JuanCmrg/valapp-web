import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "VALAPP",
  description:
    "Monitor de mercado en tiempo real: TRM, índices globales, acciones, forex y commodities.",
  applicationName: "VALAPP",
  authors: [{ name: "Juan Felipe Camargo Rivas" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VALAPP",
  },
  icons: {
    icon: [
      {
        url: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    type: "website",
    title: "VALAPP",
    description:
      "Monitor de mercado en tiempo real: TRM, índices globales, acciones, forex y commodities.",
    siteName: "VALAPP",
    locale: "es_CO",
    images: [
      {
        url: "/web-app-manifest-512x512.png",
        width: 512,
        height: 512,
        alt: "VALAPP",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "VALAPP",
    description: "Monitor de mercado en tiempo real",
    images: ["/web-app-manifest-512x512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}