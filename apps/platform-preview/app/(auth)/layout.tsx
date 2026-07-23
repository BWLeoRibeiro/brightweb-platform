import { AuthPreviewProvider } from "./auth-preview-provider";

export default function PreviewAuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthPreviewProvider>{children}</AuthPreviewProvider>;
}
