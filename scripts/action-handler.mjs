import {
  ACTION_KINDS,
  ACTION_NAMESPACE,
  ATTRIBUTE_KEYS,
  CATEGORY_IDS,
  GROUP_IDS,
  ITEM_TYPES,
  PARTY_ACTOR_TYPE,
  SETTINGS,
  SUPPORTED_ACTOR_TYPES,
  getActionId
} from "./constants.mjs";
import { getSetting } from "./settings.mjs";

function localize(key) {
  return globalThis.game?.i18n?.localize?.(key) ?? key;
}

function getAttributeName(key) {
  const systemLabel = globalThis.game?.aos?.config?.attributes?.[key];
  if (systemLabel) return localize(systemLabel);
  if (key === ATTRIBUTE_KEYS.BODY) return localize("TOKENACTIONHUD.AOS.Action.Body");
  return key;
}

function getSkillName(key) {
  const systemLabel = globalThis.game?.aos?.config?.skills?.[key];
  return systemLabel ? localize(systemLabel) : key;
}

function compareNames(left, right) {
  return left.name.localeCompare(right.name, globalThis.game?.i18n?.lang);
}

function toDisplayValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && !Number.isFinite(value)) return "—";
  return String(value);
}

function formatResource(resource) {
  const value = toDisplayValue(resource?.value);
  const maximum = toDisplayValue(resource?.max);
  if (value === null && maximum === null) return null;
  if (maximum === null) return value ?? "—";
  return `${value ?? "—"}/${maximum}`;
}

export function createActionHandler(coreModule) {
  return class ActionHandlerAos extends coreModule.api.ActionHandler {
    async buildSystemActions() {
      const actor = this.actor;
      if (!actor?.uuid) return;

      if (actor.type === PARTY_ACTOR_TYPE) {
        this.#buildActorSheetAction(actor);
        return;
      }
      if (!SUPPORTED_ACTOR_TYPES.has(actor.type)) return;

      this.#buildAttributes(actor);
      this.#buildSkills(actor);
      this.#buildItems(actor);
      this.#buildConditions(actor);
      this.#buildActorSheetAction(actor);
      this.#buildResourceSummary(actor);
    }

    #buildAttributes(actor) {
      const actions = Object.values(ATTRIBUTE_KEYS).map((key) => {
        const name = getAttributeName(key);
        return {
          id: getActionId(ACTION_KINDS.ATTRIBUTE, key),
          name,
          listName: name,
          encodedValue: `${ACTION_KINDS.ATTRIBUTE}|${key}`,
          system: {
            namespace: ACTION_NAMESPACE,
            kind: ACTION_KINDS.ATTRIBUTE,
            actorUuid: actor.uuid,
            key
          }
        };
      });

      this.addActions(actions, { id: GROUP_IDS.ATTRIBUTES, type: "system" });
    }

    #buildSkills(actor) {
      const skillLabels = globalThis.game?.aos?.config?.skills ?? {};
      const skillAttributes = globalThis.game?.aos?.config?.skillAttributes ?? {};
      const actorSkills = actor.system?.skills ?? {};
      const showUntrained = getSetting(SETTINGS.SHOW_UNTRAINED_SKILLS, true);
      const actionsByAttribute = {
        [ATTRIBUTE_KEYS.BODY]: [],
        [ATTRIBUTE_KEYS.MIND]: [],
        [ATTRIBUTE_KEYS.SOUL]: []
      };

      for (const key of Object.keys(skillLabels)) {
        const skill = actorSkills[key];
        if (!skill) continue;
        if (!showUntrained && Number(skill.training ?? 0) <= 0) continue;

        const attribute = skillAttributes[key] ?? skill.attribute;
        const actions = actionsByAttribute[attribute];
        if (!actions) continue;

        const name = getSkillName(key);
        actions.push({
          id: getActionId(ACTION_KINDS.SKILL, key),
          name,
          listName: name,
          encodedValue: `${ACTION_KINDS.SKILL}|${key}`,
          info1: {
            text: String(skill.training ?? 0),
            title: localize("TOKENACTIONHUD.AOS.Info.Training")
          },
          info2: {
            text: String(skill.focus ?? 0),
            title: localize("TOKENACTIONHUD.AOS.Info.Focus")
          },
          system: {
            namespace: ACTION_NAMESPACE,
            kind: ACTION_KINDS.SKILL,
            actorUuid: actor.uuid,
            key
          }
        });
      }

      const groupsByAttribute = {
        [ATTRIBUTE_KEYS.BODY]: GROUP_IDS.SKILLS_BODY,
        [ATTRIBUTE_KEYS.MIND]: GROUP_IDS.SKILLS_MIND,
        [ATTRIBUTE_KEYS.SOUL]: GROUP_IDS.SKILLS_SOUL
      };
      for (const [attribute, actions] of Object.entries(actionsByAttribute)) {
        actions.sort(compareNames);
        this.addActions(actions, { id: groupsByAttribute[attribute], type: "system" });
      }
    }

    #buildActorSheetAction(actor) {
      const name = localize("TOKENACTIONHUD.AOS.Action.OpenActorSheet");
      this.addActions([{
        id: getActionId(ACTION_KINDS.ACTOR_SHEET, "sheet"),
        name,
        listName: name,
        encodedValue: `${ACTION_KINDS.ACTOR_SHEET}|sheet`,
        system: {
          namespace: ACTION_NAMESPACE,
          kind: ACTION_KINDS.ACTOR_SHEET,
          actorUuid: actor.uuid
        }
      }], { id: GROUP_IDS.ACTOR, type: "system" });
    }

    #buildItems(actor) {
      const items = Array.from(actor.items ?? []).filter((item) => item?.id);
      const showUnequipped = getSetting(SETTINGS.SHOW_UNEQUIPPED_WEAPONS, false);

      const attacks = items
        .filter((item) => (
          [ITEM_TYPES.WEAPON, ITEM_TYPES.AETHERIC_DEVICE].includes(item.type)
          && Boolean(item.isAttack)
          && (showUnequipped || item.system?.equipped === true)
        ))
        .map((item) => this.#createItemAction(item, ACTION_KINDS.ATTACK))
        .sort(compareNames);
      this.addActions(attacks, { id: GROUP_IDS.ATTACKS, type: "system" });

      const spells = items
        .filter((item) => item.type === ITEM_TYPES.SPELL)
        .map((item) => this.#createItemAction(item, ACTION_KINDS.SPELL))
        .sort(compareNames);
      this.addActions(spells, { id: GROUP_IDS.SPELLS, type: "system" });

      const miracles = items
        .filter((item) => item.type === ITEM_TYPES.MIRACLE)
        .map((item) => this.#createItemAction(item, ACTION_KINDS.MIRACLE))
        .sort(compareNames);
      this.addActions(miracles, { id: GROUP_IDS.MIRACLES, type: "system" });

      const talents = items
        .filter((item) => item.type === ITEM_TYPES.TALENT)
        .map((item) => this.#createItemAction(item, ACTION_KINDS.TALENT))
        .sort(compareNames);
      this.addActions(talents, { id: GROUP_IDS.TALENTS, type: "system" });

      const inventoryGroups = {
        [ITEM_TYPES.WEAPON]: GROUP_IDS.WEAPONS,
        [ITEM_TYPES.ARMOUR]: GROUP_IDS.ARMOUR,
        [ITEM_TYPES.EQUIPMENT]: GROUP_IDS.EQUIPMENT,
        [ITEM_TYPES.AETHERIC_DEVICE]: GROUP_IDS.DEVICES,
        [ITEM_TYPES.RUNE]: GROUP_IDS.RUNES
      };
      for (const [itemType, groupId] of Object.entries(inventoryGroups)) {
        const actions = items
          .filter((item) => item.type === itemType)
          .map((item) => this.#createItemAction(item, ACTION_KINDS.INVENTORY))
          .sort(compareNames);
        this.addActions(actions, { id: groupId, type: "system" });
      }
    }

    #createItemAction(item, kind) {
      const quantity = item.system?.quantity;
      return {
        id: getActionId(kind, item.id),
        name: item.name,
        listName: item.name,
        img: item.img,
        isItem: true,
        encodedValue: `${kind}|${item.id}`,
        ...(quantity !== null && quantity !== undefined && {
          info1: {
            text: String(quantity),
            title: localize("TOKENACTIONHUD.AOS.Info.Quantity")
          }
        }),
        system: {
          namespace: ACTION_NAMESPACE,
          kind,
          actorUuid: this.actor.uuid,
          itemId: item.id
        }
      };
    }

    #buildConditions(actor) {
      const conditions = Array.from(globalThis.CONFIG?.statusEffects ?? [])
        .filter((condition) => condition?.id)
        .map((condition) => {
          const active = Boolean(actor.hasCondition?.(condition.id));
          const name = localize(condition.name);
          return {
            id: getActionId(ACTION_KINDS.CONDITION, condition.id),
            name,
            listName: name,
            img: condition.img,
            cssClass: active ? "toggle active" : "toggle",
            encodedValue: `${ACTION_KINDS.CONDITION}|${condition.id}`,
            system: {
              namespace: ACTION_NAMESPACE,
              kind: ACTION_KINDS.CONDITION,
              actorUuid: actor.uuid,
              key: condition.id
            }
          };
        })
        .sort(compareNames);

      this.addActions(conditions, { id: GROUP_IDS.CONDITIONS, type: "system" });
    }

    #buildResourceSummary(actor) {
      if (!getSetting(SETTINGS.SHOW_RESOURCE_SUMMARY, true)) return;

      const health = actor.system?.combat?.health;
      const info = {
        info1: {
          text: formatResource(health?.toughness),
          title: localize("TOKENACTIONHUD.AOS.Info.Toughness")
        },
        info2: {
          text: formatResource(health?.wounds),
          title: localize("TOKENACTIONHUD.AOS.Info.Wounds")
        },
        info3: {
          text: formatResource(actor.system?.combat?.mettle),
          title: localize("TOKENACTIONHUD.AOS.Info.Mettle")
        }
      };

      this.addGroupInfo({ id: CATEGORY_IDS.CHARACTER, info });
    }
  };
}
