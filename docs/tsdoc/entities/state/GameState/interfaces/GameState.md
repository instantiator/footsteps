[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [entities/state/GameState](../README.md) / GameState

# Interface: GameState

Defined in: [entities/state/GameState.ts:9](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/state/GameState.ts#L9)

Runtime progress of a game: its definition, per-stage progress, and what is currently showing.

## Properties

### current

> **current**: `object`

Defined in: [entities/state/GameState.ts:15](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/state/GameState.ts#L15)

What the player is currently looking at.

#### overviewDisplay

> **overviewDisplay**: [`GameOverviewDisplayPurpose`](../../../data/displays/GameDisplayData/type-aliases/GameOverviewDisplayPurpose.md) \| `null`

The overview display showing when no stage is active.

#### stageId

> **stageId**: `string` \| `null`

The stage being played, or null while an overview is showing.

***

### gameData

> **gameData**: [`GameData`](../../../data/GameData/interfaces/GameData.md)

Defined in: [entities/state/GameState.ts:11](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/state/GameState.ts#L11)

The authored definition of the game being played.

***

### stages

> **stages**: [`GameStageState`](../../GameStageState/interfaces/GameStageState.md)[]

Defined in: [entities/state/GameState.ts:13](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/state/GameState.ts#L13)

Progress for each stage, in authored order.
