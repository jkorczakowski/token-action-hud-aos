import {
  CORE_MODULE_ID,
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
  getGame = () => game ?? globalThis.game,
  hooks,
  actionHandlerFactory = createActionHandler,
  rollHandlerFactory = createRollHandler,
  systemManagerFactory = createSystemManager
}) {
  let initialized = false;

  return function registerWithCore(coreModule) {
    const currentGame = getGame();
    if (initialized || currentGame?.system?.id !== SYSTEM_ID) return false;

    const module = currentGame.modules?.get?.(MODULE_ID);
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
  game,
  hooks = globalThis.Hooks,
  getGame = () => game ?? globalThis.game
} = {}) {
  if (typeof hooks?.on !== "function") return null;
  const registrar = createCoreRegistrar({ game, getGame, hooks });
  hooks.on(HOOKS.CORE_API_READY, registrar);

  const registerExistingCoreApi = () => {
    const currentGame = getGame();
    const coreModule = currentGame?.modules?.get?.(CORE_MODULE_ID);
    const coreApi = coreModule?.api;
    if (typeof coreApi?.ActionHandler === "function"
      && typeof coreApi?.RollHandler === "function"
      && typeof coreApi?.SystemManager === "function") {
      registrar(coreModule);
    }
  };

  // Foundry can evaluate dependent ES modules before the global game object is
  // assigned. Resolve it lazily from the Core hook, while retaining a ready
  // fallback for a Core API that was published before this listener ran.
  registerExistingCoreApi();
  hooks.once?.("ready", registerExistingCoreApi);

  return registrar;
}

installRegistration();
