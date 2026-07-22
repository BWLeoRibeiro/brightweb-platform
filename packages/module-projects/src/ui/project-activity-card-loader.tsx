import { ProjectActivityCard } from "./project-activity-card";

export function ProjectActivityCardLoader({ projectId }: { projectId: string }) {
  return <ProjectActivityCard projectId={projectId} />;
}
