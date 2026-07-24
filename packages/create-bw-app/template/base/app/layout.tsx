import type { ReactNode } from "react";
import { starterBrandConfig } from "../config/brand";
import { geistMono, geistSans } from "./fonts";
import "./globals.css";

export const metadata = {
  title: `${starterBrandConfig.companyName} Starter`,
  description: starterBrandConfig.tagline,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
