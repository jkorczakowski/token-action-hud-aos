import assert from "node:assert/strict";
import test from "node:test";

import { AosActionError, dispatchAosAction } from "../scripts/aos-adapter.mjs";
import { createRollHandler } from "../scripts/roll-handler.mjs";
import { ACTION_KINDS, ACTION_NAMESPACE } from "../scripts/constants.mjs";

function createAction(kind, actorUuid, data = {}) {
  return {
    id: `aos:${kind}:${data.key ?? "sheet"}`,
    system: { namespace: ACTION_NAMESPACE, kind, actorUuid, ...data }
  };
}

test("A08 attributes and skills route only to native setupCommonTest", async () => {
  const calls = [];
  const actor = {
    isOwner: true,
    type: "player",
    uuid: "Actor.routes",
    system: {
      attributes: { body: {}, mind: {}, soul: {} },
      skills: { arcana: {} },
      setupCommonTest: async (context) => calls.push(context)
    }
  };

  assert.equal(await dispatchAosAction({
    actor,
    action: createAction(ACTION_KINDS.ATTRIBUTE, actor.uuid, { key: "mind" })
  }), true);
  assert.equal(await dispatchAosAction({
    actor,
    action: createAction(ACTION_KINDS.SKILL, actor.uuid, { key: "arcana" })
  }), true);

  assert.deepEqual(calls, [{ attribute: "mind" }, { skill: "arcana" }]);
});

test("A12 rejects a stale actor identity before any native call", async () => {
  let calls = 0;
  const actor = {
    isOwner: true,
    type: "player",
    uuid: "Actor.current",
    system: {
      attributes: { body: {} },
      setupCommonTest: () => { calls += 1; }
    }
  };

  await assert.rejects(
    dispatchAosAction({
      actor,
      action: createAction(ACTION_KINDS.ATTRIBUTE, "Actor.previous", { key: "body" })
    }),
    (error) => error instanceof AosActionError && error.code === "staleActor"
  );
  assert.equal(calls, 0);
});

test("A13 rejects execution when current ownership has been lost", async () => {
  let calls = 0;
  const actor = {
    isOwner: false,
    type: "npc",
    uuid: "Actor.permission",
    system: {
      skills: { awareness: {} },
      setupCommonTest: () => { calls += 1; }
    }
  };

  await assert.rejects(
    dispatchAosAction({
      actor,
      action: createAction(ACTION_KINDS.SKILL, actor.uuid, { key: "awareness" })
    }),
    (error) => error instanceof AosActionError && error.code === "permission"
  );
  assert.equal(calls, 0);
});

test("A15 party actors can open only their own native actor sheet", async () => {
  const renders = [];
  const actor = {
    isOwner: true,
    type: "party",
    uuid: "Actor.party",
    sheet: { render: async (options) => renders.push(options) },
    system: {}
  };

  assert.equal(await dispatchAosAction({
    actor,
    action: createAction(ACTION_KINDS.ACTOR_SHEET, actor.uuid)
  }), true);
  assert.deepEqual(renders, [{ force: true }]);
});

test("A18 the non-awaited RollHandler snapshots the intended actor before selection changes", async () => {
  const dispatched = [];
  let releaseDispatch;
  const gate = new Promise((resolve) => { releaseDispatch = resolve; });
  class FakeCoreRollHandler {
    get actor() { return this.hudManager.actor; }
    get isRightClick() { return this.hudManager.isRightClick; }
  }
  const RollHandler = createRollHandler(
    { api: { RollHandler: FakeCoreRollHandler } },
    {
      dispatch: async (context) => {
        await gate;
        dispatched.push(context);
      },
      reportError: (error) => { throw error; }
    }
  );
  const originalActor = { uuid: "Actor.original" };
  const nextActor = { uuid: "Actor.next" };
  const handler = new RollHandler();
  handler.hudManager = { actor: originalActor, isRightClick: false };
  handler.action = createAction(ACTION_KINDS.SKILL, originalActor.uuid, { key: "arcana" });

  assert.equal(handler.handleActionClick({}, "skill|arcana"), true);
  handler.hudManager.actor = nextActor;
  handler.action.system.actorUuid = nextActor.uuid;
  releaseDispatch();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].actor, originalActor);
  assert.equal(dispatched[0].action.system.actorUuid, originalActor.uuid);
});

test("A08/A09 each item action calls exactly its mapped native setup method", async () => {
  const calls = [];
  let manualRolls = 0;
  let manualChats = 0;
  const nativeResult = {
    roll: () => { manualRolls += 1; },
    sendToChat: () => { manualChats += 1; }
  };
  const items = [
    { id: "weapon", type: "weapon", isAttack: true, system: { equipped: true } },
    { id: "device", type: "aethericDevice", isAttack: "4", system: { equipped: true } },
    { id: "spell", type: "spell", system: {} },
    { id: "miracle", type: "miracle", system: {} },
    { id: "talent", type: "talent", system: {} },
    { id: "rune", type: "rune", system: {} }
  ];
  const actor = {
    isOwner: true,
    type: "player",
    uuid: "Actor.item-routes",
    items: new Map(items.map((item) => [item.id, item])),
    system: {
      setupCombatTest: (item) => { calls.push(["combat", item.id]); return nativeResult; },
      setupSpellTest: (item) => { calls.push(["spell", item.id]); return nativeResult; },
      setupMiracleTest: (item) => { calls.push(["miracle", item.id]); return nativeResult; },
      // Soulbound's fallback may return undefined without awaiting its base call.
      setupAbilityUse: (item) => { calls.push(["ability", item.id]); return undefined; }
    }
  };

  const routes = [
    [ACTION_KINDS.ATTACK, "weapon"],
    [ACTION_KINDS.ATTACK, "device"],
    [ACTION_KINDS.SPELL, "spell"],
    [ACTION_KINDS.MIRACLE, "miracle"],
    [ACTION_KINDS.TALENT, "talent"],
    [ACTION_KINDS.INVENTORY, "weapon"],
    [ACTION_KINDS.INVENTORY, "rune"]
  ];
  for (const [kind, itemId] of routes) {
    assert.equal(await dispatchAosAction({
      actor,
      action: createAction(kind, actor.uuid, { itemId })
    }), true);
  }

  assert.deepEqual(calls, [
    ["combat", "weapon"],
    ["combat", "device"],
    ["spell", "spell"],
    ["miracle", "miracle"],
    ["ability", "talent"],
    ["ability", "weapon"],
    ["ability", "rune"]
  ]);
  assert.equal(manualRolls, 0);
  assert.equal(manualChats, 0);
});

test("A10 item right-click opens the current owned item sheet without use or roll", async () => {
  const renders = [];
  let nativeCalls = 0;
  const item = {
    id: "gear",
    type: "equipment",
    system: { equipped: false },
    sheet: { render: async (options) => renders.push(options) }
  };
  const actor = {
    isOwner: true,
    type: "npc",
    uuid: "Actor.right-click",
    items: new Map([[item.id, item]]),
    system: {
      setupAbilityUse: () => { nativeCalls += 1; }
    }
  };

  assert.equal(await dispatchAosAction({
    actor,
    action: createAction(ACTION_KINDS.INVENTORY, actor.uuid, { itemId: item.id }),
    isRightClick: true
  }), true);
  assert.deepEqual(renders, [{ force: true }]);
  assert.equal(nativeCalls, 0);
});

test("A12 deleted items and kind mismatches fail before native setup", async () => {
  let nativeCalls = 0;
  const weapon = { id: "weapon", type: "weapon", isAttack: true, system: { equipped: true } };
  const actor = {
    isOwner: true,
    type: "player",
    uuid: "Actor.stale-item",
    items: new Map([[weapon.id, weapon]]),
    system: {
      setupCombatTest: () => { nativeCalls += 1; },
      setupSpellTest: () => { nativeCalls += 1; }
    }
  };

  await assert.rejects(
    dispatchAosAction({
      actor,
      action: createAction(ACTION_KINDS.ATTACK, actor.uuid, { itemId: "deleted" })
    }),
    (error) => error instanceof AosActionError && error.code === "staleItem"
  );
  await assert.rejects(
    dispatchAosAction({
      actor,
      action: createAction(ACTION_KINDS.SPELL, actor.uuid, { itemId: weapon.id })
    }),
    (error) => error instanceof AosActionError && error.code === "invalidAction"
  );
  assert.equal(nativeCalls, 0);
});

test("A11 condition left/right clicks toggle only through Soulbound actor methods", async () => {
  let active = false;
  const calls = [];
  const actor = {
    isOwner: true,
    type: "player",
    uuid: "Actor.condition-toggle",
    system: {},
    hasCondition: (id) => active && id === "prone" ? { id: "active-effect" } : null,
    addCondition: async (id) => { calls.push(["add", id]); active = true; },
    removeCondition: async (id) => { calls.push(["remove", id]); active = false; }
  };
  const action = createAction(ACTION_KINDS.CONDITION, actor.uuid, { key: "prone" });
  const previousConfig = globalThis.CONFIG;
  globalThis.CONFIG = { statusEffects: [{ id: "prone", name: "Prone", img: "prone.svg" }] };
  try {
    assert.equal(await dispatchAosAction({ actor, action, isRightClick: true }), true);
    assert.equal(await dispatchAosAction({ actor, action, isRightClick: false }), true);
  } finally {
    globalThis.CONFIG = previousConfig;
  }

  assert.deepEqual(calls, [["add", "prone"], ["remove", "prone"]]);
});

test("A17 RollHandler contains a rejected async dispatch when Core does not await", async () => {
  const reports = [];
  class FakeCoreRollHandler {
    get actor() { return this.hudManager.actor; }
    get isRightClick() { return this.hudManager.isRightClick; }
  }
  const expectedError = new Error("native rejection");
  const RollHandler = createRollHandler(
    { api: { RollHandler: FakeCoreRollHandler } },
    {
      dispatch: async () => { throw expectedError; },
      reportError: (error, context) => reports.push({ error, context })
    }
  );
  const handler = new RollHandler();
  handler.hudManager = { actor: { uuid: "Actor.error" }, isRightClick: false };
  handler.action = createAction(ACTION_KINDS.SKILL, "Actor.error", { key: "arcana" });

  assert.equal(handler.handleActionClick({}, "skill|arcana"), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reports.length, 1);
  assert.equal(reports[0].error, expectedError);
});

test("A19 RollHandler ignores non-AoS actions so Core generic handling remains intact", async () => {
  let dispatches = 0;
  class FakeCoreRollHandler {}
  const RollHandler = createRollHandler(
    { api: { RollHandler: FakeCoreRollHandler } },
    { dispatch: async () => { dispatches += 1; } }
  );
  const handler = new RollHandler();
  handler.action = { id: "core:token:hidden", system: { namespace: "core" } };

  assert.equal(handler.handleActionClick({}, "core"), false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(dispatches, 0);
});
