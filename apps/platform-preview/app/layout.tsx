import type { ReactNode } from "react";
import { starterBrandConfig } from "../config/brand";
import { ThemeProvider, ThemeScript } from "@brightweblabs/app-shell";
import "./globals.css";

export const metadata = {
  title: `${starterBrandConfig.companyName} Platform Preview`,
  description: `Internal preview app for ${starterBrandConfig.companyName} platform features.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      style={{ ["--font-body" as string]: '"Mulish", "Mulish Fallback", "Segoe UI", Arial, sans-serif' }}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript defaultTheme="light" />
      </head>
      <body>
        <ThemeProvider defaultTheme="light" disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
