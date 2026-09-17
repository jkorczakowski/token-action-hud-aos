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

  // Foundry may finish evaluating Core's module and publish its API before a
  // dependent ES module has installed its hook listener. Register immediately
  // when that already-published API is available; the registrar's once guard
  // prevents the normal hook path from registering a second time.
  const coreModule = game.modules?.get?.(CORE_MODULE_ID);
  const coreApi = coreModule?.api;
  if (typeof coreApi?.ActionHandler === "function"
    && typeof coreApi?.RollHandler === "function"
    && typeof coreApi?.SystemManager === "function") {
    registrar(coreModule);
  }

  return registrar;
}

installRegistration();
