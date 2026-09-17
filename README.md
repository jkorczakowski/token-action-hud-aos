# Token Action HUD — Age of Sigmar: Soulbound

An unofficial [Token Action HUD Core](https://github.com/Larkinabout/fvtt-token-action-hud-core) system adapter for **Warhammer Age of Sigmar: Soulbound** on Foundry Virtual Tabletop.

> [!IMPORTANT]
> Version `0.1.2` is a development release. Its automated test suite passes, but the module has not yet completed the live Foundry test matrix. See [Testing status](#testing-status) before using it in an active game.

## Features

- Body, Mind, and Soul tests.
- All 24 configured skills, grouped by attribute with Training and Focus summaries.
- Equipped attacks, including damaging aetheric devices, with an option to show unequipped attacks.
- Native spell, miracle, talent, rune, gear, and inventory workflows.
- Separate attack and inventory actions for weapons.
- Right-click access to owned item sheets while the HUD is locked.
- Native Soulbound condition toggles.
- Toughness, Wounds, and Mettle summaries.
- Actor-sheet access for player, NPC, and party actors.
- Stable action IDs compatible with Token Action HUD Core layout customization.
- Core-provided token, macro, compendium, and extender actions remain available.

All rolls and item uses are delegated to Soulbound's native methods. This module does not reproduce game rules, create an extra roll or chat message, apply damage, or spend resources itself.

## Compatibility

| Component | Minimum tested target |
| --- | ---: |
| Foundry Virtual Tabletop | 14.367 |
| Age of Sigmar: Soulbound | 9.0.1 |
| Token Action HUD Core | 2.1.1 |

Soulbound also requires **Warhammer Library**, and Token Action HUD Core requires **socketlib**. Install and enable the dependency versions appropriate for your Foundry and Soulbound installation.

The module ID is `token-action-hud-aos`.

## Installation

### Using the manifest URL

1. Open Foundry's **Setup** screen and select **Add-on Modules**.
2. Select **Install Module**.
3. Paste the following address into **Manifest URL**:

   ```text
   https://raw.githubusercontent.com/jkorczakowski/token-action-hud-aos/refs/heads/master/module.json
   ```

4. Select **Install**.
5. Open a Soulbound world and enable Token Action HUD — Age of Sigmar: Soulbound and its dependencies in **Manage Modules**.

### From a GitHub release

1. Download `token-action-hud-aos-<version>.zip` from this repository's [Releases page](../../releases).
2. Close Foundry Virtual Tabletop.
3. Locate your Foundry **User Data** directory. Its location is shown in Foundry's Configuration tab.
4. Extract the archive into `Data/modules/token-action-hud-aos` beneath that directory.
5. Confirm that `module.json` is directly inside `token-action-hud-aos`, not inside a second nested folder.
6. Start Foundry and open a Soulbound world.
7. In **Manage Modules**, enable Warhammer Library, socketlib, Token Action HUD Core, and Token Action HUD — Age of Sigmar: Soulbound.

The resulting layout should be:

```text
FoundryVTT/
└── Data/
    └── modules/
        └── token-action-hud-aos/
            ├── module.json
            ├── scripts/
            └── languages/
```

### From source

Clone or download the repository, then copy or link its root directory to `Data/modules/token-action-hud-aos`. No dependency installation or build step is required for runtime use.

## Usage

Select one owned player or NPC token and use Token Action HUD normally:

- Left-click an action to open Soulbound's native test dialog or item-use workflow.
- Right-click an item-backed action to open that owned item's sheet without using it.
- Left- or right-click a condition to toggle it through Soulbound's actor methods.
- Use the Actor group to open the selected actor's sheet.
- Unlock the HUD to customize its layout using Core's standard controls.

When no token is selected, Token Action HUD Core's assigned-character fallback is used when available. Party actors receive actor-sheet access only. Multiple selected tokens and unsupported actor types do not receive Soulbound-specific actions, but Core's generic actions remain available.

### Settings

The following client settings are available under **Configure Settings → Module Settings**:

- **Show Unequipped Attacks** — disabled by default.
- **Show Untrained Skills** — enabled by default.
- **Show Resource Summary** — enabled by default.

## Testing status

The automated checks cover module registration, action construction, actor selection, settings, dispatch validation, stale documents, permissions, and asynchronous error handling. Run them with:

```console
npm run check
npm test
```

Live registration, HUD creation, and one native common-test workflow have passed. The full Foundry test matrix is not yet complete, so version `0.1.2` should still be treated as a development release. Please report unexpected behavior through GitHub Issues.

## Current limitations

- Soulbound-specific actions support one selected player or NPC token at a time.
- Party actors provide actor-sheet access only.
- Party automation and multi-actor rolls are not included.
- Resource values are summaries rather than editable controls.
- Initiative utilities, modifier-key shortcuts, and custom themes are not included.
- Soulbound `9.0.1` may log a Foundry 14 deprecation warning about `ChatMessage.applyRollMode` during a successful native roll. The warning originates in Soulbound's chat-message code rather than this adapter.
- Soulbound `9.0.1` may also log a `Roll.fromData` error when using an inventory item that has no roll. The native item card still appears, but Soulbound supplies an undefined roll entry to Foundry; this adapter deliberately continues to use Soulbound's public `setupAbilityUse` workflow.

## Development

The project uses plain JavaScript ES modules and has no production npm dependencies. The main implementation is under `scripts/`, translations are under `languages/`, and focused tests are under `tests/`.

## Reporting issues

Open a GitHub issue with the Foundry, Soulbound, Token Action HUD Core, Warhammer Library, and socketlib versions you are using. Include reproduction steps and relevant console errors, but do not attach private world data, licensed game content, access tokens, or other credentials.

## Disclaimer

This is an unofficial community project. It is not affiliated with or endorsed by Foundry Gaming LLC, Games Workshop, Cubicle 7, or the maintainers of Token Action HUD Core.
