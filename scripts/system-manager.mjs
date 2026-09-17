import { SYSTEM_TITLE } from "./constants.mjs";
import { buildDefaults } from "./defaults.mjs";
import { registerSettings } from "./settings.mjs";

export function createSystemManager(coreModule, ActionHandler, RollHandler) {
  return class SystemManagerAos extends coreModule.api.SystemManager {
    getActionHandler() {
      return new ActionHandler();
    }

    getAvailableRollHandlers() {
      return { core: SYSTEM_TITLE };
    }

    getRollHandler() {
      return new RollHandler();
    }

    registerSettings(coreUpdate) {
      registerSettings(coreUpdate);
    }

    async registerDefaults() {
      return buildDefaults();
    }

    registerStyles() {
      return {};
    }
  };
}
