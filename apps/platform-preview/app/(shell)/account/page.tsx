import { AccountPage } from "@brightweblabs/core-auth";
import { ClientProjectsPreview } from "@brightweblabs/module-projects";

export default function AccountPreviewPage() {
  return <AccountPage projectsSlot={<ClientProjectsPreview />} />;
}
