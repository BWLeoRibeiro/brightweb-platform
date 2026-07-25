import { requireServerUserAccess } from "../server";
import { createAccountGetHandler, createAccountUpdateHandler } from "./http";
import { getCurrentAccountProfile, updateCurrentAccountProfile } from "./profile";

const dependencies = {
  getAccess: () => requireServerUserAccess(),
  getProfile: getCurrentAccountProfile,
  updateProfile: updateCurrentAccountProfile,
};

export const handleAccountGetRequest = createAccountGetHandler(dependencies);
export const handleAccountUpdateRequest = createAccountUpdateHandler(dependencies);
