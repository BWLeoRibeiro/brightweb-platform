import { starterBrandConfig } from "./brand";
import { getStarterEnvStatus, isStarterEnvReady } from "./env";
import { getStarterShellConfig } from "./shell";

export function getStarterClientConfig() {
  const shell = getStarterShellConfig();
  const enabledModules = shell.enabledModules;
  const moduleKeys = enabledModules.map((moduleConfig) => moduleConfig.key);

  return {
    brand: starterBrandConfig,
    enabledModules,
    envStatus: getStarterEnvStatus(),
    envReadiness: isStarterEnvReady(moduleKeys),
    shellPreview: shell.shellPreview,
    toolbarRoutes: shell.toolbarRoutes,
  };
}
