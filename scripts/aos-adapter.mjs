import {
  ACTION_KINDS,
  ACTION_NAMESPACE,
  ATTRIBUTE_KEYS,
  ITEM_TYPES,
  MODULE_ID,
  PARTY_ACTOR_TYPE,
  SETTINGS,
  SUPPORTED_ACTOR_TYPES
} from "./constants.mjs";
import { getSetting } from "./settings.mjs";

const ATTRIBUTE_KEY_SET = new Set(Object.values(ATTRIBUTE_KEYS));
const ITEM_ACTION_KIND_SET = new Set([
  ACTION_KINDS.ATTACK,
  ACTION_KINDS.SPELL,
  ACTION_KINDS.MIRACLE,
  ACTION_KINDS.TALENT,
  ACTION_KINDS.INVENTORY
]);

const ERROR_KEYS = Object.freeze({
  invalidAction: "TOKENACTIONHUD.AOS.Error.InvalidAction",
  unsupportedActor: "TOKENACTIONHUD.AOS.Error.UnsupportedActor",
  staleActor: "TOKENACTIONHUD.AOS.Error.StaleActor",
  staleItem: "TOKENACTIONHUD.AOS.Error.StaleItem",
  permission: "TOKENACTIONHUD.AOS.Error.Permission",
  unavailable: "TOKENACTIONHUD.AOS.Error.Unavailable"
});

export class AosActionError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "AosActionError";
    this.code = code;
  }
}

/**
 * Dispatch one metadata-backed AoS action against the exact actor supplied by
 * Core. Native Soulbound setup methods own dialogs, rolls, chat, and costs.
 */
export async function dispatchAosAction({ actor, action, isRightClick = false }) {
  const metadata = action?.system;
  if (metadata?.namespace !== ACTION_NAMESPACE) return false;

  if (!actor) {
    throw new AosActionError("unsupportedActor");
  }
  if (!actor.uuid || metadata.actorUuid !== actor.uuid) {
    throw new AosActionError("staleActor");
  }
  if (actor.isOwner !== true) {
    throw new AosActionError("permission");
  }

  if (metadata.kind === ACTION_KINDS.ACTOR_SHEET) {
    if (![...SUPPORTED_ACTOR_TYPES, PARTY_ACTOR_TYPE].includes(actor.type)) {
      throw new AosActionError("unsupportedActor");
    }
    if (isRightClick) return true;
    if (typeof actor.sheet?.render !== "function") {
      throw new AosActionError("unavailable");
    }
    await actor.sheet.render({ force: true });
    return true;
  }

  if (!SUPPORTED_ACTOR_TYPES.has(actor.type)) {
    throw new AosActionError("unsupportedActor");
  }

  if (metadata.kind === ACTION_KINDS.ATTRIBUTE) {
    if (isRightClick) return true;
    if (!ATTRIBUTE_KEY_SET.has(metadata.key) || !(metadata.key in (actor.system?.attributes ?? {}))) {
      throw new AosActionError("invalidAction");
    }
    await setupCommonTest(actor, { attribute: metadata.key });
    return true;
  }

  if (metadata.kind === ACTION_KINDS.SKILL) {
    if (isRightClick) return true;
    if (!metadata.key || !(metadata.key in (actor.system?.skills ?? {}))) {
      throw new AosActionError("invalidAction");
    }
    await setupCommonTest(actor, { skill: metadata.key });
    return true;
  }

  if (metadata.kind === ACTION_KINDS.CONDITION) {
    const conditionExists = Array.from(globalThis.CONFIG?.statusEffects ?? [])
      .some((condition) => condition?.id === metadata.key);
    if (!conditionExists) throw new AosActionError("invalidAction");
    if (typeof actor.hasCondition !== "function"
      || typeof actor.addCondition !== "function"
      || typeof actor.removeCondition !== "function") {
      throw new AosActionError("unavailable");
    }

    if (actor.hasCondition(metadata.key)) {
      await actor.removeCondition(metadata.key);
    } else {
      await actor.addCondition(metadata.key);
    }
    return true;
  }

  if (!ITEM_ACTION_KIND_SET.has(metadata.kind)) {
    throw new AosActionError("invalidAction");
  }

  const item = getOwnedItem(actor, metadata.itemId);
  validateItemKind(item, metadata.kind);

  if (isRightClick) {
    if (typeof item.sheet?.render !== "function") {
      throw new AosActionError("unavailable");
    }
    await item.sheet.render({ force: true });
    return true;
  }

  switch (metadata.kind) {
    case ACTION_KINDS.ATTACK:
      if (!item.isAttack) throw new AosActionError("invalidAction");
      if (!getSetting(SETTINGS.SHOW_UNEQUIPPED_WEAPONS, false) && item.system?.equipped !== true) {
        throw new AosActionError("invalidAction");
      }
      await callNative(actor, "setupCombatTest", item);
      return true;
    case ACTION_KINDS.SPELL:
      await callNative(actor, "setupSpellTest", item);
      return true;
    case ACTION_KINDS.MIRACLE:
      await callNative(actor, "setupMiracleTest", item);
      return true;
    case ACTION_KINDS.TALENT:
    case ACTION_KINDS.INVENTORY:
      await callNative(actor, "setupAbilityUse", item);
      return true;
    default:
      throw new AosActionError("invalidAction");
  }
}

async function setupCommonTest(actor, context) {
  const setupCommonTest = actor.system?.setupCommonTest;
  if (typeof setupCommonTest !== "function") {
    throw new AosActionError("unavailable");
  }

  await setupCommonTest.call(actor.system, context);
}

function getOwnedItem(actor, itemId) {
  if (!itemId) throw new AosActionError("invalidAction");
  const collection = actor.items;
  const item = typeof collection?.get === "function"
    ? collection.get(itemId)
    : Array.from(collection ?? []).find((candidate) => candidate?.id === itemId);
  if (!item) throw new AosActionError("staleItem");
  return item;
}

function validateItemKind(item, kind) {
  const validTypes = {
    [ACTION_KINDS.ATTACK]: [ITEM_TYPES.WEAPON, ITEM_TYPES.AETHERIC_DEVICE],
    [ACTION_KINDS.SPELL]: [ITEM_TYPES.SPELL],
    [ACTION_KINDS.MIRACLE]: [ITEM_TYPES.MIRACLE],
    [ACTION_KINDS.TALENT]: [ITEM_TYPES.TALENT],
    [ACTION_KINDS.INVENTORY]: [
      ITEM_TYPES.WEAPON,
      ITEM_TYPES.ARMOUR,
      ITEM_TYPES.EQUIPMENT,
      ITEM_TYPES.AETHERIC_DEVICE,
      ITEM_TYPES.RUNE
    ]
  };
  if (!validTypes[kind]?.includes(item.type)) throw new AosActionError("invalidAction");
}

async function callNative(actor, methodName, item) {
  const method = actor.system?.[methodName];
  if (typeof method !== "function") throw new AosActionError("unavailable");
  await method.call(actor.system, item);
}

function localize(key) {
  return globalThis.game?.i18n?.localize?.(key) ?? key;
}

export function reportDispatchError(error, { actor, action } = {}) {
  if (error instanceof AosActionError) {
    const key = ERROR_KEYS[error.code] ?? ERROR_KEYS.invalidAction;
    globalThis.ui?.notifications?.warn?.(localize(key));
    return;
  }

  const kind = action?.system?.kind ?? "unknown";
  const actorUuid = actor?.uuid ?? action?.system?.actorUuid ?? "unknown";
  console.error(`${MODULE_ID} | Action dispatch failed`, { error, kind, actorUuid });
  globalThis.ui?.notifications?.error?.(localize("TOKENACTIONHUD.AOS.Error.Unexpected"));
}
