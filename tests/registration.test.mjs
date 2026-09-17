import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CATEGORY_IDS,
  CORE_MODULE_ID,
  GROUP_IDS,
  HOOKS,
  MODULE_ID,
  REQUIRED_CORE_API_VERSION,
  SYSTEM_ID
} from "../scripts/constants.mjs";
import { buildDefaults } from "../scripts/defaults.mjs";
import { createCoreRegistrar, installRegistration } from "../scripts/main.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function createFakeCore() {
  return {
    api: {
      ActionHandler: class ActionHandler {},
      RollHandler: class RollHandler {},
      SystemManager: class SystemManager {}
    }
  };
}

test("A01 registers once after the Core API exists and publishes API family 2.1", () => {
  const coreModule = createFakeCore();
  const module = { id: MODULE_ID };
  const calls = [];
  const hooks = { call: (...args) => calls.push(args) };
  const game = {
    system: { id: SYSTEM_ID },
    modules: new Map([[MODULE_ID, module]])
  };
  const factoriesCalled = [];

  const registrar = createCoreRegistrar({
    game,
    hooks,
    actionHandlerFactory: (core) => {
      factoriesCalled.push("action");
      assert.equal(core, coreModule);
      return class extends core.api.ActionHandler {};
    },
    rollHandlerFactory: (core) => {
      factoriesCalled.push("roll");
      return class extends core.api.RollHandler {};
    },
    systemManagerFactory: (core, ActionHandler, RollHandler) => {
      factoriesCalled.push("manager");
      assert.equal(Object.getPrototypeOf(ActionHandler), core.api.ActionHandler);
      assert.equal(Object.getPrototypeOf(RollHandler), core.api.RollHandler);
      return class extends core.api.SystemManager {};
    }
  });

  assert.deepEqual(factoriesCalled, []);
  assert.equal(registrar(coreModule), true);
  assert.deepEqual(factoriesCalled, ["action", "roll", "manager"]);
  assert.equal(module.api.requiredCoreModuleVersion, REQUIRED_CORE_API_VERSION);
  assert.equal(Object.getPrototypeOf(module.api.SystemManager), coreModule.api.SystemManager);
  assert.deepEqual(calls, [[HOOKS.SYSTEM_READY, module]]);

  assert.equal(registrar(coreModule), false);
  assert.equal(calls.length, 1);
});

test("A02 ignores the Core ready hook for another game system", () => {
  const module = { id: MODULE_ID };
  const calls = [];
  const registrar = createCoreRegistrar({
    game: {
      system: { id: "not-soulbound" },
      modules: new Map([[MODULE_ID, module]])
    },
    hooks: { call: (...args) => calls.push(args) }
  });

  assert.equal(registrar(createFakeCore()), false);
  assert.equal(module.api, undefined);
  assert.deepEqual(calls, []);
});

test("A01 registers when Core published its API before the adapter listener loaded", () => {
  const coreModule = createFakeCore();
  const module = { id: MODULE_ID };
  const listeners = new Map();
  const calls = [];
  const hooks = {
    on: (name, callback) => listeners.set(name, callback),
    call: (...args) => calls.push(args)
  };
  const game = {
    system: { id: SYSTEM_ID },
    modules: new Map([
      [CORE_MODULE_ID, coreModule],
      [MODULE_ID, module]
    ])
  };

  const registrar = installRegistration({ game, hooks });

  assert.equal(typeof registrar, "function");
  assert.equal(listeners.get(HOOKS.CORE_API_READY), registrar);
  assert.equal(module.api.requiredCoreModuleVersion, REQUIRED_CORE_API_VERSION);
  assert.equal(Object.getPrototypeOf(module.api.SystemManager), coreModule.api.SystemManager);
  assert.deepEqual(calls, [[HOOKS.SYSTEM_READY, module]]);

  assert.equal(registrar(coreModule), false);
  assert.equal(calls.length, 1);
});

test("A01 published manager creates the AoS handlers and fresh defaults", async () => {
  const coreModule = createFakeCore();
  const module = { id: MODULE_ID };
  const registrar = createCoreRegistrar({
    game: {
      system: { id: SYSTEM_ID },
      modules: new Map([[MODULE_ID, module]])
    },
    hooks: { call: () => {} }
  });

  assert.equal(registrar(coreModule), true);
  const manager = new module.api.SystemManager();
  assert.ok(manager instanceof coreModule.api.SystemManager);
  assert.ok(manager.getActionHandler() instanceof coreModule.api.ActionHandler);
  assert.ok(manager.getRollHandler("core") instanceof coreModule.api.RollHandler);
  assert.deepEqual(manager.getAvailableRollHandlers(), {
    core: "Age of Sigmar: Soulbound"
  });

  const firstDefaults = await manager.registerDefaults();
  const secondDefaults = await manager.registerDefaults();
  assert.notEqual(firstDefaults, secondDefaults);
  assert.notEqual(firstDefaults.layout, secondDefaults.layout);
  const stableIds = (defaults) => defaults.layout.flatMap((category) => [
    category.nestId,
    ...category.groups.map((group) => group.nestId)
  ]);
  assert.deepEqual(stableIds(firstDefaults), stableIds(secondDefaults));
  firstDefaults.layout[0].groups[0].name = "User-customized label";
  assert.notEqual(firstDefaults.layout[0].groups[0].name, secondDefaults.layout[0].groups[0].name);
});

test("A03 defaults contain permanent unique nest IDs and all referenced groups", () => {
  const defaults = buildDefaults((key) => key);
  const availableGroups = new Set(defaults.groups.map((group) => group.id));
  const expectedGroups = new Set(Object.values(GROUP_IDS));
  assert.deepEqual(availableGroups, expectedGroups);
  assert.deepEqual(new Set(defaults.layout.map((category) => category.id)), new Set(Object.values(CATEGORY_IDS)));
  assert.ok(defaults.layout.every((category) => category.type === "system"));
  assert.ok(defaults.groups.every((group) => group.type === "system"));

  const nestIds = defaults.layout.flatMap((category) => [
    category.nestId,
    ...category.groups.map((group) => group.nestId)
  ]);
  assert.equal(new Set(nestIds).size, nestIds.length);

  for (const category of defaults.layout) {
    for (const group of category.groups) assert.ok(availableGroups.has(group.id));
  }
});

test("A03 manifest is valid and every declared runtime path exists", async () => {
  const manifestPath = path.join(ROOT, "module.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  assert.equal(manifest.id, MODULE_ID);
  assert.equal(manifest.version, "0.1.1");
  assert.equal(manifest.relationships.systems[0].id, SYSTEM_ID);
  assert.equal(manifest.relationships.requires[0].id, "token-action-hud-core");
  assert.equal(manifest.relationships.requires[0].compatibility.minimum, "2.1.1");

  const runtimePaths = [
    ...manifest.esmodules,
    ...manifest.languages.map((language) => language.path)
  ];
  for (const relativePath of runtimePaths) {
    await access(path.join(ROOT, relativePath));
  }
});
