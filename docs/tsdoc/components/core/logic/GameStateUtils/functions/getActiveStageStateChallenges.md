[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/GameStateUtils](../README.md) / getActiveStageStateChallenges

# Function: getActiveStageStateChallenges()

> **getActiveStageStateChallenges**(`gameState`): `object`

Defined in: [components/core/logic/GameStateUtils.ts:47](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/components/core/logic/GameStateUtils.ts#L47)

Retrieves the current stage state and its active challenges from the game state.

## Parameters

### gameState

[`GameState`](../../../../../entities/state/GameState/interfaces/GameState.md)

the current game state

## Returns

the current stage state and the first chunk of challenges with any still active, or nulls if no current stage is set.

### activeChallengeStates

> **activeChallengeStates**: [`GameChallengeState`](../../../../../entities/state/GameChallengeState/interfaces/GameChallengeState.md)[] \| `null`

The challenges to show now, or null if no stage is open.

### stageState

> **stageState**: [`GameStageState`](../../../../../entities/state/GameStageState/interfaces/GameStageState.md) \| `null`

The current stage's state, or null if no stage is open.
