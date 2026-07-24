import type { ShellBrand } from "@brightweblabs/app-shell";
import { starterBrandConfig } from "./brand";

export const starterShellBrand = {
  href: "/",
  ariaLabel: `${starterBrandConfig.companyName} public site`,
  alt: starterBrandConfig.companyName,
  collapsedLogo: {
    src: "/brand/logo-mark.svg",
    width: 48,
    height: 48,
  },
  lightLogo: {
    src: "/brand/logo-light.svg",
    width: 176,
    height: 44,
  },
  darkLogo: {
    src: "/brand/logo-dark.svg",
    width: 176,
    height: 44,
  },
  statusPageLogo: {
    light: {
      src: "/brand/mark.svg",
      width: 326,
      height: 267,
    },
    dark: {
      src: "/brand/mark-dark.svg",
      width: 326,
      height: 267,
    },
  },
} satisfies ShellBrand;
