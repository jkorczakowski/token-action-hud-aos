import assert from "node:assert/strict";
import test from "node:test";

import { createActionHandler } from "../scripts/action-handler.mjs";
import { ACTION_KINDS, GROUP_IDS } from "../scripts/constants.mjs";

function buildHarness(actor, actors = []) {
  const additions = [];
  const groupInfo = [];
  class FakeCoreActionHandler {
    constructor() {
      this.hudManager = { actor, actors };
    }
    get actor() { return this.hudManager.actor; }
    get actors() { return this.hudManager.actors; }
    addActions(actions, group) { additions.push({ actions, group }); }
    addGroupInfo(info) { groupInfo.push(info); }
  }
  const ActionHandler = createActionHandler({ api: { ActionHandler: FakeCoreActionHandler } });
  return { additions, groupInfo, handler: new ActionHandler() };
}

async function buildWithMinimalGame(harness) {
  const previousGame = globalThis.game;
  globalThis.game = {
    aos: {
      config: {
        attributes: { body: "Body", mind: "Mind", soul: "Soul" },
        skillAttributes: {},
        skills: {}
      }
    },
    i18n: { localize: (key) => key },
    settings: { get: () => true }
  };
  try {
    await harness.handler.buildSystemActions([]);
  } finally {
    globalThis.game = previousGame;
  }
  return harness;
}

test("A15 no actor and multiple actors produce no AoS-specific actions", async () => {
  const noActor = await buildWithMinimalGame(buildHarness(null));
  assert.deepEqual(noActor.additions, []);
  assert.deepEqual(noActor.groupInfo, []);

  const multiple = await buildWithMinimalGame(buildHarness(null, [
    { uuid: "Actor.one" },
    { uuid: "Actor.two" }
  ]));
  assert.deepEqual(multiple.additions, []);
  assert.deepEqual(multiple.groupInfo, []);
});

test("A15 party actors expose actor-sheet access without combat assumptions", async () => {
  const actor = { type: "party", uuid: "Actor.party", system: {} };
  const harness = await buildWithMinimalGame(buildHarness(actor));

  assert.equal(harness.additions.length, 1);
  assert.equal(harness.additions[0].group.id, GROUP_IDS.ACTOR);
  assert.equal(harness.additions[0].actions[0].system.kind, ACTION_KINDS.ACTOR_SHEET);
  assert.equal(harness.additions[0].actions[0].system.actorUuid, actor.uuid);
  assert.deepEqual(harness.groupInfo, []);
});

test("A14/A16 assigned and synthetic actors use the supplied actor without requiring a token", async () => {
  const actor = {
    type: "player",
    uuid: "Scene.synthetic.Token.token.Actor.synthetic",
    system: {
      attributes: { body: {}, mind: {}, soul: {} },
      skills: {},
      combat: {
        health: { toughness: { value: 0, max: 5 }, wounds: { value: 1, max: 2 } },
        mettle: { value: 2, max: 3 }
      }
    }
  };
  const harness = await buildWithMinimalGame(buildHarness(actor));
  const actions = harness.additions.flatMap((addition) => addition.actions);

  assert.ok(actions.length > 0);
  assert.ok(actions.every((action) => action.system.actorUuid === actor.uuid));
  assert.equal(harness.handler.hudManager.token, undefined);
});

test("A15 unsupported actor types produce no AoS-specific actions", async () => {
  const harness = await buildWithMinimalGame(buildHarness({
    type: "vehicle",
    uuid: "Actor.unsupported",
    system: {}
  }));
  assert.deepEqual(harness.additions, []);
  assert.deepEqual(harness.groupInfo, []);
});
