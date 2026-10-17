import "@brightweblabs/app-shell/dashboard.css";
import { Suspense } from "react";
import { UnifiedTasksPreview } from "./unified-tasks-preview";

export default function UnifiedTasksPreviewPage() {
  return <Suspense fallback={<p>A carregar…</p>}><UnifiedTasksPreview /></Suspense>;
}
