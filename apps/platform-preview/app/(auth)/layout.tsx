import { AuthProvider } from "./auth-provider";

export default function PreviewAuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
