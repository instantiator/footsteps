[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/TemplateUtils](../README.md) / DecoratedGameState

# Type Alias: DecoratedGameState

> **DecoratedGameState** = [`GameState`](../../../../../entities/state/GameState/interfaces/GameState.md) & `object`

Defined in: [components/core/logic/TemplateUtils.ts:6](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/components/core/logic/TemplateUtils.ts#L6)

The game state plus derived values, for Mustache templates (which can't compute them).

## Type Declaration

### stages

> **stages**: [`DecoratedStageState`](DecoratedStageState.md)[]

Each stage's state, with its template values.

### totalStages

> **totalStages**: `number`

The number of stages in the game.
