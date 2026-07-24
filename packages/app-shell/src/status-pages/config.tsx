import type { ComponentType } from "react";
import type { ShellBrand } from "../types";
import { NotFoundPage, type NotFoundPageProps } from "./not-found-page";

export type AppShellStatusPagesConfig = {
  brand: ShellBrand;
};

export type ConfiguredNotFoundPageProps = Omit<NotFoundPageProps, "brand">;

export type AppShellStatusPages = {
  NotFoundPage: ComponentType<ConfiguredNotFoundPageProps>;
};

export function createAppShellStatusPages({
  brand,
}: AppShellStatusPagesConfig): AppShellStatusPages {
  function ConfiguredNotFoundPage(props: ConfiguredNotFoundPageProps) {
    return <NotFoundPage {...props} brand={brand} />;
  }

  return { NotFoundPage: ConfiguredNotFoundPage };
}
