import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

const DESCRIPTION =
  "Monitor de mercado en tiempo real: TRM, tasas e inflación de Colombia, índices globales, acciones, forex, commodities y cripto.";

export const metadata: Metadata = {
  metadataBase: new URL("https://valapp-web.vercel.app"),
  title: "VALAPP",
  description: DESCRIPTION,
  applicationName: "VALAPP",
  authors: [{ name: "Juan Felipe Camargo Rivas" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VALAPP",
  },
  icons: {
    icon: [
      { url: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    title: "VALAPP",
    description: DESCRIPTION,
    siteName: "VALAPP",
    locale: "es_CO",
    images: [{ url: "/web-app-manifest-512x512.png", width: 512, height: 512, alt: "VALAPP" }],
  },
  twitter: {
    card: "summary",
    title: "VALAPP",
    description: "Monitor de mercado en tiempo real",
    images: ["/web-app-manifest-512x512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  width: "device-width",
  initialScale: 1,
};

// Se ejecuta antes de pintar para que no parpadee el tema equivocado.
const THEME_SCRIPT = `try{var t=localStorage.getItem("valapp.theme");if(!t)t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
