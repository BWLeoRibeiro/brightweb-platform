import type { ReactNode } from "react";

type AppHeaderProps = {
  children: ReactNode;
  className: string;
};

export function AppHeader({ children, className }: AppHeaderProps) {
  return <header className={className}>{children}</header>;
}
