import { CATEGORY_IDS, GROUP_IDS } from "./constants.mjs";

const CATEGORY_SPECS = Object.freeze([
  [CATEGORY_IDS.CHARACTER, "TOKENACTIONHUD.AOS.Category.Character", [GROUP_IDS.ATTRIBUTES]],
  [CATEGORY_IDS.SKILLS, "TOKENACTIONHUD.AOS.Category.Skills", [GROUP_IDS.SKILLS_BODY, GROUP_IDS.SKILLS_MIND, GROUP_IDS.SKILLS_SOUL]],
  [CATEGORY_IDS.COMBAT, "TOKENACTIONHUD.AOS.Category.Combat", [GROUP_IDS.ATTACKS]],
  [CATEGORY_IDS.MAGIC, "TOKENACTIONHUD.AOS.Category.Magic", [GROUP_IDS.SPELLS, GROUP_IDS.MIRACLES]],
  [CATEGORY_IDS.ABILITIES, "TOKENACTIONHUD.AOS.Category.Abilities", [GROUP_IDS.TALENTS]],
  [CATEGORY_IDS.INVENTORY, "TOKENACTIONHUD.AOS.Category.Inventory", [GROUP_IDS.WEAPONS, GROUP_IDS.ARMOUR, GROUP_IDS.EQUIPMENT, GROUP_IDS.DEVICES, GROUP_IDS.RUNES]],
  [CATEGORY_IDS.CONDITIONS, "TOKENACTIONHUD.AOS.Category.Conditions", [GROUP_IDS.CONDITIONS]],
  [CATEGORY_IDS.UTILITY, "TOKENACTIONHUD.AOS.Category.Utility", [GROUP_IDS.ACTOR, GROUP_IDS.TOKEN]]
]);

const GROUP_SPECS = Object.freeze([
  [GROUP_IDS.ATTRIBUTES, "TOKENACTIONHUD.AOS.Group.Attributes"],
  [GROUP_IDS.SKILLS_BODY, "TOKENACTIONHUD.AOS.Group.BodySkills"],
  [GROUP_IDS.SKILLS_MIND, "TOKENACTIONHUD.AOS.Group.MindSkills"],
  [GROUP_IDS.SKILLS_SOUL, "TOKENACTIONHUD.AOS.Group.SoulSkills"],
  [GROUP_IDS.ATTACKS, "TOKENACTIONHUD.AOS.Group.Attacks"],
  [GROUP_IDS.SPELLS, "TOKENACTIONHUD.AOS.Group.Spells"],
  [GROUP_IDS.MIRACLES, "TOKENACTIONHUD.AOS.Group.Miracles"],
  [GROUP_IDS.TALENTS, "TOKENACTIONHUD.AOS.Group.Talents"],
  [GROUP_IDS.WEAPONS, "TOKENACTIONHUD.AOS.Group.Weapons"],
  [GROUP_IDS.ARMOUR, "TOKENACTIONHUD.AOS.Group.Armour"],
  [GROUP_IDS.EQUIPMENT, "TOKENACTIONHUD.AOS.Group.Equipment"],
  [GROUP_IDS.DEVICES, "TOKENACTIONHUD.AOS.Group.Devices"],
  [GROUP_IDS.RUNES, "TOKENACTIONHUD.AOS.Group.Runes"],
  [GROUP_IDS.CONDITIONS, "TOKENACTIONHUD.AOS.Group.Conditions"],
  [GROUP_IDS.ACTOR, "TOKENACTIONHUD.AOS.Group.Actor"],
  [GROUP_IDS.TOKEN, "tokenActionHud.token"]
]);

function defaultLocalize(key) {
  return globalThis.game?.i18n?.localize?.(key) ?? key;
}

/**
 * Build a fresh localized default layout. Core persists these IDs, so every
 * category, subgroup, and nest ID is intentionally stable.
 */
export function buildDefaults(localize = defaultLocalize) {
  const groups = GROUP_SPECS.map(([id, labelKey]) => {
    const name = localize(labelKey);
    return { id, name, listName: `Group: ${name}`, type: "system" };
  });
  const groupsById = new Map(groups.map((group) => [group.id, group]));

  const layout = CATEGORY_SPECS.map(([id, labelKey, subgroupIds]) => ({
    id,
    nestId: id,
    name: localize(labelKey),
    type: "system",
    groups: subgroupIds.map((subgroupId) => ({
      ...groupsById.get(subgroupId),
      nestId: `${id}_${subgroupId}`
    }))
  }));

  return { layout, groups };
}
