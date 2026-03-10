# Projects Migrations

`projects` owns work-management and collaboration tables.

## Owns

- `projects`
- `project_members`
- `project_milestones`
- `project_tasks`
- `project_links`
- `project_status_log`
- project access helpers
- project activity triggers and policies

## Dependency

Depends on:

- `core`
- `admin` for global role helpers
- `crm` when project access depends on organizations or organization membership
