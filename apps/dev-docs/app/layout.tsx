import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dev.brightweb.pt"),
  title: {
    default: "BrightWeb Platform Docs",
    template: "%s | BrightWeb Platform Docs",
  },
  description: "Internal developer documentation for how the BrightWeb platform currently works.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
