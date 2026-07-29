import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { starterBrandConfig } from "../config/brand";
import { ThemeProvider, ThemeScript } from "@brightweblabs/app-shell";
import { geistMono, geistSans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: `${starterBrandConfig.companyName} Starter`,
  description: starterBrandConfig.tagline,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript defaultTheme="system" />
      </head>
      <body>
        <ThemeProvider defaultTheme="system" disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
