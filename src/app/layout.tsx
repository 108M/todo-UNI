import type { Metadata, Viewport } from "next";
import { Bangers, Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/service-worker-registrar";

const displayFont = Bangers({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aulario To-Do",
  description: "Agenda de tareas y entregas de la universidad, en un sitio.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aulario To-Do",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${displayFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {process.env.DEMO_MODE === "true" && (
          <div className="w-full bg-amber-400 text-black text-sm text-center py-1.5 px-4 font-medium">
            Modo demo — datos de ejemplo, no hay correo ni Aulario reales conectados. Se reinician periódicamente.
          </div>
        )}
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
