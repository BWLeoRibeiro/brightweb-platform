import { ProjectsRoutePage } from "@brightweblabs/module-projects/routes";

const navigation = { listHref: "/projects", detailHrefPattern: "/projects/:projectId", boardHrefPattern: "/projects/:projectId/tasks" };

export default function ProjectsPreviewPage() {
  return <ProjectsRoutePage navigation={navigation} />;
}
