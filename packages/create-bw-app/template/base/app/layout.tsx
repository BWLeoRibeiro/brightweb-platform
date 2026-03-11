import type { ReactNode } from "react";
import { starterBrandConfig } from "../config/brand";
import "./globals.css";

export const metadata = {
  title: `${starterBrandConfig.companyName} Starter`,
  description: starterBrandConfig.tagline,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
