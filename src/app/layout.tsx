import type { Metadata, Viewport } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}