export type StarterBrandConfig = {
  companyName: string;
  productName: string;
  slug: string;
  tagline: string;
  contactEmail: string;
  supportEmail: string;
};

export const starterBrandConfig: StarterBrandConfig = {
  companyName: "Starter Client",
  productName: "Operations Platform",
  slug: "starter-client",
  tagline: "A configurable Brightweb starter app for shipping new client instances without rebuilding the platform.",
  contactEmail: "hello@example.com",
  supportEmail: "support@example.com",
};

export type StarterShellLogo = {
  src: string;
  width: number;
  height: number;
};

export type StarterShellBrand = {
  href: string;
  ariaLabel: string;
  alt: string;
  collapsedLogo: StarterShellLogo;
  lightLogo: StarterShellLogo;
  darkLogo: StarterShellLogo;
};

/**
 * Shell brand marks. This file is written once when the app is scaffolded and
 * is never regenerated, so swapping in client artwork here survives
 * `create-bw-app update` — unlike editing config/shell.ts.
 */
export const starterShellBrand: StarterShellBrand = {
  href: "/",
  ariaLabel: `${starterBrandConfig.companyName} public site`,
  alt: starterBrandConfig.companyName,
  collapsedLogo: { src: "/brand/logo-mark.svg", width: 48, height: 48 },
  lightLogo: { src: "/brand/logo-light.svg", width: 176, height: 44 },
  darkLogo: { src: "/brand/logo-dark.svg", width: 176, height: 44 },
};
