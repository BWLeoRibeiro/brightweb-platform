import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dev.brightweb.pt"),
  title: {
    default: "BrightWeb Stack Docs",
    template: "%s | BrightWeb Stack Docs",
  },
  description: "Public, repo-backed documentation for how BrightWeb Stack works.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
