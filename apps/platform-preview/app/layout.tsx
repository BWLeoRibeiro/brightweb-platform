import type { ReactNode } from "react";
import { Mulish } from "next/font/google";
import { starterBrandConfig } from "../config/brand";
import "./globals.css";

// Loaded for MQ-theme parity comparison: MQ's portal body face is Mulish.
const mulish = Mulish({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-mulish",
});

export const metadata = {
  title: `${starterBrandConfig.companyName} Platform Preview`,
  description: `Internal preview app for ${starterBrandConfig.companyName} platform features.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={mulish.variable}
      style={{ ["--font-body" as string]: "var(--font-mulish), system-ui, sans-serif" }}
    >
      <body>{children}</body>
    </html>
  );
}
