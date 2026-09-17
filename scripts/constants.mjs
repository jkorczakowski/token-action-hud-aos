export const MODULE_ID = "token-action-hud-aos";
export const MODULE_TITLE = "Token Action HUD — Age of Sigmar: Soulbound";
export const CORE_MODULE_ID = "token-action-hud-core";
export const SYSTEM_ID = "age-of-sigmar-soulbound";
export const SYSTEM_TITLE = "Age of Sigmar: Soulbound";
export const REQUIRED_CORE_API_VERSION = "2.1";
export const ACTION_NAMESPACE = "aos";

export const HOOKS = Object.freeze({
  CORE_API_READY: "tokenActionHudCoreApiReady",
  SYSTEM_READY: "tokenActionHudSystemReady"
});

export const ACTION_KINDS = Object.freeze({
  ACTOR_SHEET: "actorSheet",
  ATTRIBUTE: "attribute",
  ATTACK: "attack",
  CONDITION: "condition",
  INVENTORY: "inventory",
  MIRACLE: "miracle",
  SPELL: "spell",
  TALENT: "talent",
  SKILL: "skill"
});

export const ATTRIBUTE_KEYS = Object.freeze({
  BODY: "body",
  MIND: "mind",
  SOUL: "soul"
});

export const SUPPORTED_ACTOR_TYPES = Object.freeze(new Set(["player", "npc"]));
export const PARTY_ACTOR_TYPE = "party";

export const SETTINGS = Object.freeze({
  SHOW_RESOURCE_SUMMARY: "showResourceSummary",
  SHOW_UNEQUIPPED_WEAPONS: "showUnequippedWeapons",
  SHOW_UNTRAINED_SKILLS: "showUntrainedSkills"
});

export const ITEM_TYPES = Object.freeze({
  AETHERIC_DEVICE: "aethericDevice",
  ARMOUR: "armour",
  EQUIPMENT: "equipment",
  MIRACLE: "miracle",
  RUNE: "rune",
  SPELL: "spell",
  TALENT: "talent",
  WEAPON: "weapon"
});

export const CATEGORY_IDS = Object.freeze({
  CHARACTER: "aosCharacter",
  SKILLS: "aosSkills",
  COMBAT: "aosCombat",
  MAGIC: "aosMagic",
  ABILITIES: "aosAbilities",
  INVENTORY: "aosInventory",
  CONDITIONS: "aosConditionCategory",
  UTILITY: "aosUtility"
});

export const GROUP_IDS = Object.freeze({
  ATTRIBUTES: "aosAttributes",
  SKILLS_BODY: "aosSkillsBody",
  SKILLS_MIND: "aosSkillsMind",
  SKILLS_SOUL: "aosSkillsSoul",
  ATTACKS: "aosAttacks",
  SPELLS: "aosSpells",
  MIRACLES: "aosMiracles",
  TALENTS: "aosTalents",
  WEAPONS: "aosWeapons",
  ARMOUR: "aosArmour",
  EQUIPMENT: "aosEquipment",
  DEVICES: "aosDevices",
  RUNES: "aosRunes",
  CONDITIONS: "aosConditions",
  ACTOR: "aosActor",
  TOKEN: "token"
});

export function getActionId(kind, key) {
  return `${ACTION_NAMESPACE}:${kind}:${key}`;
}
