import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientOnly } from "@/components/layout/ClientOnly";
import { ThemeProvider } from "@/components/theme-provider";
import { BackgroundFetcher } from "@/components/BackgroundFetcher";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "BrewPlans",
  description: "Plan your trip with real-time flight, train, and hotel data.",
  icons: {
    icon: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} font-sans h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-hidden">
        <ThemeProvider>
          <ClientOnly>
            <BackgroundFetcher />
            {children}
          </ClientOnly>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
