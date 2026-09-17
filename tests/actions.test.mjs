import assert from "node:assert/strict";
import test from "node:test";

import { createActionHandler } from "../scripts/action-handler.mjs";
import {
  ACTION_KINDS,
  ACTION_NAMESPACE,
  ATTRIBUTE_KEYS,
  CATEGORY_IDS,
  GROUP_IDS,
  MODULE_ID,
  SETTINGS,
  getActionId
} from "../scripts/constants.mjs";
import { createRollHandler } from "../scripts/roll-handler.mjs";

const SKILL_ATTRIBUTES = Object.freeze({
  arcana: "mind",
  athletics: "body",
  awareness: "mind",
  ballisticSkill: "body",
  beastHandling: "soul",
  channelling: "mind",
  crafting: "mind",
  determination: "soul",
  devotion: "soul",
  dexterity: "body",
  entertain: "soul",
  fortitude: "body",
  guile: "mind",
  intimidation: "soul",
  intuition: "mind",
  lore: "mind",
  medicine: "mind",
  might: "body",
  nature: "mind",
  reflexes: "body",
  stealth: "body",
  survival: "mind",
  theology: "mind",
  weaponSkill: "body"
});

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createFakeActionHandlerBase(additions, groupInfo) {
  return class FakeCoreActionHandler {
    constructor() {
      this.hudManager = {};
    }

    get actor() {
      return this.hudManager.actor;
    }

    addActions(actions, group) {
      additions.push({ actions, group });
    }

    addGroupInfo(info) {
      groupInfo.push(info);
    }
  };
}

function createGame({
  showResources = true,
  showUnequipped = false,
  showUntrained = true,
  skillAttributes = {},
  skills = {}
} = {}) {
  const labels = {
    "ATTRIBUTE.BODY": "Body",
    "ATTRIBUTE.MIND": "Mind",
    "ATTRIBUTE.SOUL": "Soul"
  };
  for (const [key, value] of Object.entries(skills)) labels[value] = `Skill ${key}`;

  return {
    aos: {
      config: {
        attributes: {
          body: "ATTRIBUTE.BODY",
          mind: "ATTRIBUTE.MIND",
          soul: "ATTRIBUTE.SOUL"
        },
        skillAttributes,
        skills
      }
    },
    i18n: {
      lang: "en",
      localize: (key) => labels[key] ?? key
    },
    settings: {
      get: (moduleId, key) => {
        assert.equal(moduleId, MODULE_ID);
        if (key === SETTINGS.SHOW_RESOURCE_SUMMARY) return showResources;
        if (key === SETTINGS.SHOW_UNEQUIPPED_WEAPONS) return showUnequipped;
        if (key === SETTINGS.SHOW_UNTRAINED_SKILLS) return showUntrained;
        return undefined;
      }
    }
  };
}

async function withGame(game, operation) {
  const previousGame = globalThis.game;
  globalThis.game = game;
  try {
    return await operation();
  } finally {
    globalThis.game = previousGame;
  }
}

test("M1 keeps the Body action for the exact selected actor", async () => {
  const additions = [];
  const groupInfo = [];
  const FakeCoreActionHandler = createFakeActionHandlerBase(additions, groupInfo);
  const ActionHandler = createActionHandler({ api: { ActionHandler: FakeCoreActionHandler } });
  const handler = new ActionHandler();
  const actor = {
    type: "player",
    uuid: "Scene.test.Token.synthetic.Actor.synthetic",
    system: {
      attributes: { body: {}, mind: {}, soul: {} },
      skills: {},
      combat: {}
    }
  };
  handler.hudManager.actor = actor;

  await withGame(createGame(), () => handler.buildSystemActions([]));

  const attributes = additions.find((addition) => addition.group.id === GROUP_IDS.ATTRIBUTES);
  assert.ok(attributes);
  assert.equal(attributes.actions.length, 3);
  const body = attributes.actions.find((action) => action.id === "aos:attribute:body");
  assert.deepEqual(body, {
    id: getActionId(ACTION_KINDS.ATTRIBUTE, ATTRIBUTE_KEYS.BODY),
    name: "Body",
    listName: "Body",
    encodedValue: "attribute|body",
    system: {
      namespace: ACTION_NAMESPACE,
      kind: ACTION_KINDS.ATTRIBUTE,
      actorUuid: actor.uuid,
      key: ATTRIBUTE_KEYS.BODY
    }
  });
  assert.equal(body.onClick, undefined);
});

test("A04 builds all attributes and 24 configured skills with localized sorting", async () => {
  const additions = [];
  const groupInfo = [];
  const ActionHandler = createActionHandler({
    api: { ActionHandler: createFakeActionHandlerBase(additions, groupInfo) }
  });
  const handler = new ActionHandler();
  const skillLabels = Object.fromEntries(
    Object.keys(SKILL_ATTRIBUTES).reverse().map((key) => [key, `SKILL.${key}`])
  );
  const actorSkills = Object.fromEntries(
    Object.keys(SKILL_ATTRIBUTES).map((key, index) => [key, {
      training: index === 0 ? 0 : (index % 3) + 1,
      focus: index === 0 ? 0 : index % 2
    }])
  );
  const actor = {
    type: "npc",
    uuid: "Actor.standard",
    system: {
      attributes: { body: {}, mind: {}, soul: {} },
      skills: actorSkills,
      combat: {
        health: {
          toughness: { value: 0, max: 5 },
          wounds: { value: 0, max: 3 }
        },
        mettle: { value: 0, max: 1 }
      }
    }
  };
  handler.hudManager.actor = actor;

  await withGame(createGame({
    skillAttributes: SKILL_ATTRIBUTES,
    skills: skillLabels
  }), () => handler.buildSystemActions([]));

  const attributes = additions.find((addition) => addition.group.id === GROUP_IDS.ATTRIBUTES);
  assert.equal(attributes.actions.length, 3);

  const skillGroups = additions.filter((addition) => [
    GROUP_IDS.SKILLS_BODY,
    GROUP_IDS.SKILLS_MIND,
    GROUP_IDS.SKILLS_SOUL
  ].includes(addition.group.id));
  const skillActions = skillGroups.flatMap((addition) => addition.actions);
  assert.equal(skillActions.length, 24);
  assert.equal(new Set(skillActions.map((action) => action.id)).size, 24);
  assert.ok(skillActions.every((action) => action.system.actorUuid === actor.uuid));
  assert.ok(skillActions.every((action) => action.system.kind === ACTION_KINDS.SKILL));

  for (const group of skillGroups) {
    const names = group.actions.map((action) => action.name);
    assert.deepEqual(names, [...names].sort((left, right) => left.localeCompare(right, "en")));
  }

  const arcana = skillActions.find((action) => action.system.key === "arcana");
  assert.deepEqual(arcana.info1, { text: "0", title: "TOKENACTIONHUD.AOS.Info.Training" });
  assert.deepEqual(arcana.info2, { text: "0", title: "TOKENACTIONHUD.AOS.Info.Focus" });

  const actorSheet = additions.find((addition) => addition.group.id === GROUP_IDS.ACTOR);
  assert.equal(actorSheet.actions.length, 1);
  assert.equal(actorSheet.actions[0].system.actorUuid, actor.uuid);

  assert.deepEqual(groupInfo, [{
    id: CATEGORY_IDS.CHARACTER,
    info: {
      info1: { text: "0/5", title: "TOKENACTIONHUD.AOS.Info.Toughness" },
      info2: { text: "0/3", title: "TOKENACTIONHUD.AOS.Info.Wounds" },
      info3: { text: "0/1", title: "TOKENACTIONHUD.AOS.Info.Mettle" }
    }
  }]);
});

test("A05 optional filter hides zero-training skills and summary setting hides resources", async () => {
  const additions = [];
  const groupInfo = [];
  const ActionHandler = createActionHandler({
    api: { ActionHandler: createFakeActionHandlerBase(additions, groupInfo) }
  });
  const handler = new ActionHandler();
  handler.hudManager.actor = {
    type: "player",
    uuid: "Actor.filtered",
    system: {
      attributes: { body: {}, mind: {}, soul: {} },
      skills: {
        athletics: { training: 0, focus: 0 },
        might: { training: 1, focus: 0 }
      },
      combat: {
        health: { toughness: { value: 0, max: 0 }, wounds: { value: 0, max: 0 } },
        mettle: { value: 0, max: 0 }
      }
    }
  };

  await withGame(createGame({
    showResources: false,
    showUntrained: false,
    skillAttributes: { athletics: "body", might: "body" },
    skills: { athletics: "SKILL.athletics", might: "SKILL.might" }
  }), () => handler.buildSystemActions([]));

  const bodySkills = additions.find((addition) => addition.group.id === GROUP_IDS.SKILLS_BODY);
  assert.deepEqual(bodySkills.actions.map((action) => action.system.key), ["might"]);
  assert.deepEqual(groupInfo, []);
});

test("A06 equipped boolean filters attacks while inventory retains every item", async () => {
  const items = [
    { id: "weapon-equipped", name: "Hammer", type: "weapon", isAttack: true, img: "hammer.webp", system: { equipped: true, quantity: 1 } },
    { id: "weapon-unequipped", name: "Axe", type: "weapon", isAttack: true, img: "axe.webp", system: { equipped: false, state: "equipped", quantity: 0 } },
    { id: "device-damaging", name: "Blast Device", type: "aethericDevice", isAttack: "4", img: "device.webp", system: { equipped: true, quantity: 1 } },
    { id: "device-utility", name: "Utility Device", type: "aethericDevice", isAttack: false, img: "utility.webp", system: { equipped: true, quantity: 1 } },
    { id: "armour", name: "Plate", type: "armour", img: "plate.webp", system: { equipped: false, quantity: 1 } },
    { id: "equipment", name: "Rope", type: "equipment", img: "rope.webp", system: { equipped: false, quantity: 2 } },
    { id: "rune", name: "Rune", type: "rune", img: "rune.webp", system: { equipped: false } },
    { id: "spell", name: "Bolt", type: "spell", img: "spell.webp", system: {} },
    { id: "miracle", name: "Prayer", type: "miracle", img: "miracle.webp", system: {} },
    { id: "talent", name: "Gift", type: "talent", img: "talent.webp", system: {} }
  ];
  const actor = {
    type: "player",
    uuid: "Actor.items",
    items,
    system: { attributes: { body: {}, mind: {}, soul: {} }, skills: {}, combat: {} }
  };

  const build = async (showUnequipped) => {
    const additions = [];
    const groupInfo = [];
    const ActionHandler = createActionHandler({
      api: { ActionHandler: createFakeActionHandlerBase(additions, groupInfo) }
    });
    const handler = new ActionHandler();
    handler.hudManager.actor = actor;
    await withGame(createGame({ showUnequipped }), () => handler.buildSystemActions([]));
    return additions;
  };

  const filtered = await build(false);
  const filteredAttacks = filtered.find((addition) => addition.group.id === GROUP_IDS.ATTACKS).actions;
  assert.deepEqual(filteredAttacks.map((action) => action.system.itemId), ["device-damaging", "weapon-equipped"]);

  const weaponInventory = filtered.find((addition) => addition.group.id === GROUP_IDS.WEAPONS).actions;
  assert.equal(weaponInventory.length, 2);
  const zeroQuantity = weaponInventory.find((action) => action.system.itemId === "weapon-unequipped");
  assert.deepEqual(zeroQuantity.info1, { text: "0", title: "TOKENACTIONHUD.AOS.Info.Quantity" });
  assert.equal(filtered.find((addition) => addition.group.id === GROUP_IDS.DEVICES).actions.length, 2);
  assert.equal(filtered.find((addition) => addition.group.id === GROUP_IDS.SPELLS).actions.length, 1);
  assert.equal(filtered.find((addition) => addition.group.id === GROUP_IDS.MIRACLES).actions.length, 1);
  assert.equal(filtered.find((addition) => addition.group.id === GROUP_IDS.TALENTS).actions.length, 1);

  const unfiltered = await build(true);
  assert.deepEqual(
    unfiltered.find((addition) => addition.group.id === GROUP_IDS.ATTACKS).actions.map((action) => action.system.itemId),
    ["weapon-unequipped", "device-damaging", "weapon-equipped"]
  );
});

test("A07 duplicate names and combat-versus-inventory use retain distinct IDs", async () => {
  const additions = [];
  const groupInfo = [];
  const ActionHandler = createActionHandler({
    api: { ActionHandler: createFakeActionHandlerBase(additions, groupInfo) }
  });
  const handler = new ActionHandler();
  handler.hudManager.actor = {
    type: "npc",
    uuid: "Actor.duplicates",
    items: [
      { id: "first", name: "Sword", type: "weapon", isAttack: true, img: "sword.webp", system: { equipped: true, quantity: 1 } },
      { id: "second", name: "Sword", type: "weapon", isAttack: true, img: "sword.webp", system: { equipped: true, quantity: 1 } }
    ],
    system: { attributes: { body: {}, mind: {}, soul: {} }, skills: {}, combat: {} }
  };

  await withGame(createGame(), () => handler.buildSystemActions([]));
  const attacks = additions.find((addition) => addition.group.id === GROUP_IDS.ATTACKS).actions;
  const inventory = additions.find((addition) => addition.group.id === GROUP_IDS.WEAPONS).actions;

  assert.deepEqual(new Set(attacks.map((action) => action.id)), new Set(["aos:attack:first", "aos:attack:second"]));
  assert.deepEqual(new Set(inventory.map((action) => action.id)), new Set(["aos:inventory:first", "aos:inventory:second"]));
  assert.notEqual(attacks[0].id, inventory.find((action) => action.system.itemId === attacks[0].system.itemId).id);
  assert.ok([...attacks, ...inventory].every((action) => action.onClick === undefined));
});

test("A11 condition actions use CONFIG status effects and reflect active state", async () => {
  const additions = [];
  const groupInfo = [];
  const ActionHandler = createActionHandler({
    api: { ActionHandler: createFakeActionHandlerBase(additions, groupInfo) }
  });
  const handler = new ActionHandler();
  handler.hudManager.actor = {
    type: "player",
    uuid: "Actor.conditions",
    items: [],
    hasCondition: (id) => id === "poisoned" ? { id: "effect" } : null,
    system: { attributes: { body: {}, mind: {}, soul: {} }, skills: {}, combat: {} }
  };

  const previousConfig = globalThis.CONFIG;
  globalThis.CONFIG = {
    statusEffects: [
      { id: "poisoned", name: "Poisoned", img: "poisoned.svg" },
      { id: "blinded", name: "Blinded", img: "blinded.svg" }
    ]
  };
  try {
    await withGame(createGame(), () => handler.buildSystemActions([]));
  } finally {
    globalThis.CONFIG = previousConfig;
  }

  const conditions = additions.find((addition) => addition.group.id === GROUP_IDS.CONDITIONS).actions;
  assert.deepEqual(conditions.map((action) => action.id), ["aos:condition:blinded", "aos:condition:poisoned"]);
  assert.equal(conditions[0].cssClass, "toggle");
  assert.equal(conditions[1].cssClass, "toggle active");
  assert.equal(conditions[1].system.actorUuid, "Actor.conditions");
  assert.equal(conditions[1].onClick, undefined);
});

test("M4 rebuilds preserve item IDs while reflecting rename, equip, create, and delete", async () => {
  const actor = {
    type: "npc",
    uuid: "Actor.rebuild",
    items: [
      { id: "first", name: "Blade", type: "weapon", isAttack: true, system: { equipped: true, quantity: 1 } }
    ],
    system: { attributes: { body: {}, mind: {}, soul: {} }, skills: {}, combat: {} }
  };

  const build = async () => {
    const additions = [];
    const ActionHandler = createActionHandler({
      api: { ActionHandler: createFakeActionHandlerBase(additions, []) }
    });
    const handler = new ActionHandler();
    handler.hudManager.actor = actor;
    await withGame(createGame(), () => handler.buildSystemActions([]));
    return additions;
  };

  const initial = await build();
  assert.equal(initial.find((entry) => entry.group.id === GROUP_IDS.ATTACKS).actions[0].id, "aos:attack:first");

  actor.items[0].name = "Renamed Blade";
  actor.items[0].system.equipped = false;
  const renamedUnequipped = await build();
  assert.deepEqual(renamedUnequipped.find((entry) => entry.group.id === GROUP_IDS.ATTACKS).actions, []);
  const retainedInventory = renamedUnequipped.find((entry) => entry.group.id === GROUP_IDS.WEAPONS).actions;
  assert.deepEqual(retainedInventory.map(({ id, name }) => ({ id, name })), [
    { id: "aos:inventory:first", name: "Renamed Blade" }
  ]);

  actor.items.push({ id: "second", name: "Bow", type: "weapon", isAttack: true, system: { equipped: true, quantity: 1 } });
  actor.items.shift();
  const replaced = await build();
  assert.deepEqual(replaced.find((entry) => entry.group.id === GROUP_IDS.ATTACKS).actions.map((action) => action.id), [
    "aos:attack:second"
  ]);
  assert.deepEqual(replaced.find((entry) => entry.group.id === GROUP_IDS.WEAPONS).actions.map((action) => action.id), [
    "aos:inventory:second"
  ]);
});

test("M1 Body dispatch calls only native setupCommonTest even when Core does not await", async () => {
  const calls = [];
  let manualRolls = 0;
  const actor = {
    isOwner: true,
    type: "player",
    uuid: "Actor.body-test",
    system: {
      attributes: { body: {}, mind: {}, soul: {} },
      setupCommonTest: (context) => {
        calls.push(context);
        return { roll: () => { manualRolls += 1; } };
      }
    }
  };

  class FakeCoreRollHandler {
    constructor() {
      this.action = null;
      this.hudManager = null;
    }

    get actor() {
      return this.hudManager?.actor;
    }

    get isRightClick() {
      return this.hudManager?.isRightClick;
    }
  }

  const RollHandler = createRollHandler({ api: { RollHandler: FakeCoreRollHandler } });
  const handler = new RollHandler();
  handler.hudManager = { actor, isRightClick: false };
  handler.action = {
    id: getActionId(ACTION_KINDS.ATTRIBUTE, ATTRIBUTE_KEYS.BODY),
    system: {
      namespace: ACTION_NAMESPACE,
      kind: ACTION_KINDS.ATTRIBUTE,
      actorUuid: actor.uuid,
      key: ATTRIBUTE_KEYS.BODY
    }
  };

  assert.equal(handler.handleActionClick({}, "attribute|body"), true);
  await nextTurn();

  assert.deepEqual(calls, [{ attribute: ATTRIBUTE_KEYS.BODY }]);
  assert.equal(manualRolls, 0);
});
