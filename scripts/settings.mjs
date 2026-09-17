import { MODULE_ID, SETTINGS } from "./constants.mjs";

const SETTING_DEFINITIONS = Object.freeze([
  {
    key: SETTINGS.SHOW_UNEQUIPPED_WEAPONS,
    name: "TOKENACTIONHUD.AOS.Settings.ShowUnequippedWeapons.Name",
    hint: "TOKENACTIONHUD.AOS.Settings.ShowUnequippedWeapons.Hint",
    default: false
  },
  {
    key: SETTINGS.SHOW_UNTRAINED_SKILLS,
    name: "TOKENACTIONHUD.AOS.Settings.ShowUntrainedSkills.Name",
    hint: "TOKENACTIONHUD.AOS.Settings.ShowUntrainedSkills.Hint",
    default: true
  },
  {
    key: SETTINGS.SHOW_RESOURCE_SUMMARY,
    name: "TOKENACTIONHUD.AOS.Settings.ShowResourceSummary.Name",
    hint: "TOKENACTIONHUD.AOS.Settings.ShowResourceSummary.Hint",
    default: true
  }
]);

function localize(key) {
  return globalThis.game?.i18n?.localize?.(key) ?? key;
}

export function registerSettings(coreUpdate) {
  for (const definition of SETTING_DEFINITIONS) {
    globalThis.game.settings.register(MODULE_ID, definition.key, {
      name: localize(definition.name),
      hint: localize(definition.hint),
      scope: "client",
      config: true,
      type: Boolean,
      default: definition.default,
      onChange: (value) => {
        if (typeof coreUpdate === "function") coreUpdate(value);
      }
    });
  }
}

export function getSetting(key, fallback) {
  try {
    const value = globalThis.game?.settings?.get?.(MODULE_ID, key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
