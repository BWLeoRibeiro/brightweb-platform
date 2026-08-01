import { requireServiceRoleClient } from "@brightweblabs/infra/server";
import { requireServerRoleAccess } from "../server";
import {
  createNotificationsGetHandler,
  createNotificationsDeleteHandler,
  createNotificationsPostHandler,
  type NotificationHttpDependencies,
} from "./http";

const dependencies: NotificationHttpDependencies = {
  getAccess: async () => {
    const access = await requireServerRoleAccess(["staff", "admin"]);
    return access.ok
      ? { ok: true, profileId: access.profileId }
      : access;
  },
  getServiceClient: requireServiceRoleClient,
};

export const handleNotificationsGetRequest = createNotificationsGetHandler(dependencies);
export const handleNotificationsPostRequest = createNotificationsPostHandler(dependencies);
export const handleNotificationsDeleteRequest = createNotificationsDeleteHandler(dependencies);
