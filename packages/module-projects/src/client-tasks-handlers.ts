import { requireServerUserAccess } from "@brightweblabs/core-auth/server";
import {
  actOnClientProjectTask,
  getProjectClientTaskWorkbench,
  listClientProjectTasks,
  manageProjectClientTask,
} from "./client-tasks";
import {
  createClientProjectTaskPostHandler,
  createClientProjectTasksGetHandler,
  createProjectClientTaskPatchHandler,
  createProjectClientTasksGetHandler,
  createProjectClientTasksPostHandler,
} from "./client-tasks-http";

const dependencies = {
  getAccess: requireServerUserAccess,
  actOnClientProjectTask,
  getProjectClientTaskWorkbench,
  listClientProjectTasks,
  manageProjectClientTask,
};

export const handleClientProjectTasksGetRequest = createClientProjectTasksGetHandler(dependencies);
export const handleClientProjectTaskPostRequest = createClientProjectTaskPostHandler(dependencies);
export const handleProjectClientTasksGetRequest = createProjectClientTasksGetHandler(dependencies);
export const handleProjectClientTasksPostRequest = createProjectClientTasksPostHandler(dependencies);
export const handleProjectClientTaskPatchRequest = createProjectClientTaskPatchHandler(dependencies);
