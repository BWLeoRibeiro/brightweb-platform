import { createAppShellStatusPages } from "@brightweblabs/app-shell";
import { starterShellBrand } from "./shell-brand";

export const { NotFoundPage: StarterNotFoundPage } = createAppShellStatusPages({
  brand: starterShellBrand,
});
