import type { Metadata } from "next";
import { Bangers, Inter } from "next/font/google";
import "./globals.css";

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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${displayFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
