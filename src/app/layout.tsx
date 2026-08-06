import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Zonlix — Prospección con IA para agencias y PYMEs",
    template: "%s | Zonlix",
  },
  description:
    "Encuentra, audita y contacta prospectos de forma automatizada. Powered by IA.",
  keywords: ["prospección", "CRM", "IA", "agencias", "PYMEs", "ventas"],
  authors: [{ name: "Zonlix" }],
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: "Zonlix",
    title: "Zonlix — Prospección con IA",
    description:
      "Encuentra, audita y contacta prospectos de forma automatizada.",
  },
};

import { ThemeProvider } from "@/components/providers/theme-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} h-full`}
      suppressHydrationWarning
    >
      <body className={`${geistSans.variable} font-sans min-h-full bg-[#F8F9FB] text-slate-900 antialiased dark:bg-[#090D16] dark:text-slate-100`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
