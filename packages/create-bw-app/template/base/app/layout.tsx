import type { ReactNode } from "react";
import { starterBrandConfig } from "../config/brand";
import { mulish } from "./fonts";
import "./globals.css";

export const metadata = {
  title: `${starterBrandConfig.companyName} Starter`,
  description: starterBrandConfig.tagline,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${mulish.className} ${mulish.variable}`}
        style={{ ["--font-body" as string]: "var(--font-mulish)" }}
      >
        {children}
      </body>
    </html>
  );
}
