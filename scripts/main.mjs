import {
  HOOKS,
  MODULE_ID,
  REQUIRED_CORE_API_VERSION,
  SYSTEM_ID
} from "./constants.mjs";
import { createActionHandler } from "./action-handler.mjs";
import { createRollHandler } from "./roll-handler.mjs";
import { createSystemManager } from "./system-manager.mjs";

export function createCoreRegistrar({
  game,
  hooks,
  actionHandlerFactory = createActionHandler,
  rollHandlerFactory = createRollHandler,
  systemManagerFactory = createSystemManager
}) {
  let initialized = false;

  return function registerWithCore(coreModule) {
    if (initialized || game?.system?.id !== SYSTEM_ID) return false;

    const module = game.modules?.get?.(MODULE_ID);
    if (!module) {
      console.error(`${MODULE_ID} | Module record is unavailable during Core registration`);
      return false;
    }

    const ActionHandler = actionHandlerFactory(coreModule);
    const RollHandler = rollHandlerFactory(coreModule);
    const SystemManager = systemManagerFactory(coreModule, ActionHandler, RollHandler);

    module.api = {
      requiredCoreModuleVersion: REQUIRED_CORE_API_VERSION,
      SystemManager
    };

    initialized = true;
    hooks.call(HOOKS.SYSTEM_READY, module);
    return true;
  };
}

export function installRegistration({
  game = globalThis.game,
  hooks = globalThis.Hooks
} = {}) {
  if (!game || typeof hooks?.on !== "function") return null;
  const registrar = createCoreRegistrar({ game, hooks });
  hooks.on(HOOKS.CORE_API_READY, registrar);
  return registrar;
}

installRegistration();
