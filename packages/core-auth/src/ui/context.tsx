"use client";

import { createContext, useContext } from "react";
import { defaultAuthUiDictionary } from "./dictionary";
import type { AuthUiConfig, AuthUiDictionary } from "./types";

type AuthUiContextValue = AuthUiConfig & { dictionary: AuthUiDictionary };

const AuthUiContext = createContext<AuthUiContextValue | null>(null);

export function AuthUiProvider({
  children,
  dictionary = defaultAuthUiDictionary,
  ...config
}: AuthUiConfig & { children: React.ReactNode; dictionary?: AuthUiDictionary }) {
  return <AuthUiContext.Provider value={{ ...config, dictionary }}>{children}</AuthUiContext.Provider>;
}

export function useAuthUi() {
  const value = useContext(AuthUiContext);
  if (!value) throw new Error("Auth UI components must be rendered inside AuthUiProvider.");
  return value;
}
