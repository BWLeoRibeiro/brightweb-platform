import type { ReactNode } from "react";
import { starterBrandConfig } from "../config/brand";
import "./globals.css";

export const metadata = {
  title: `${starterBrandConfig.companyName} Platform Preview`,
  description: `Internal preview app for ${starterBrandConfig.companyName} platform features.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      style={{ ["--font-body" as string]: '"Mulish", "Segoe UI", Arial, sans-serif' }}
    >
      <body>{children}</body>
    </html>
  );
}
