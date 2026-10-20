[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/TemplateUtils](../README.md) / DecoratedStageState

# Type Alias: DecoratedStageState

> **DecoratedStageState** = [`GameStageState`](../../../../../entities/state/GameStageState/interfaces/GameStageState.md) & `object`

Defined in: [components/core/logic/TemplateUtils.ts:14](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/components/core/logic/TemplateUtils.ts#L14)

A stage's state plus derived values, for Mustache templates.

## Type Declaration

### index

> **index**: `number`

Zero-based position in the game's stages.

### oneIndex

> **oneIndex**: `number`

One-based position, for display to players.

### showCompleted

> **showCompleted**: `boolean`

The stage is completed.

### showLocked

> **showLocked**: `boolean`

The stage is locked.

### showUnlocked

> **showUnlocked**: `boolean`

The stage is available to play: unlocked and not yet completed.
