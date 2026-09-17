import assert from "node:assert/strict";
import test from "node:test";

import { MODULE_ID, SETTINGS } from "../scripts/constants.mjs";
import { registerSettings } from "../scripts/settings.mjs";

test("M3 registers all client display settings with refresh callbacks", () => {
  const registrations = [];
  const updates = [];
  const previousGame = globalThis.game;
  globalThis.game = {
    i18n: { localize: (key) => key },
    settings: {
      register: (moduleId, key, data) => registrations.push({ moduleId, key, data })
    }
  };
  try {
    registerSettings((value) => updates.push(value));
  } finally {
    globalThis.game = previousGame;
  }

  assert.deepEqual(registrations.map(({ moduleId, key, data }) => ({
    moduleId,
    key,
    scope: data.scope,
    default: data.default,
    type: data.type
  })), [
    {
      moduleId: MODULE_ID,
      key: SETTINGS.SHOW_UNEQUIPPED_WEAPONS,
      scope: "client",
      default: false,
      type: Boolean
    },
    {
      moduleId: MODULE_ID,
      key: SETTINGS.SHOW_UNTRAINED_SKILLS,
      scope: "client",
      default: true,
      type: Boolean
    },
    {
      moduleId: MODULE_ID,
      key: SETTINGS.SHOW_RESOURCE_SUMMARY,
      scope: "client",
      default: true,
      type: Boolean
    }
  ]);

  registrations[0].data.onChange(true);
  registrations[1].data.onChange(false);
  registrations[2].data.onChange(true);
  assert.deepEqual(updates, [true, false, true]);
});
