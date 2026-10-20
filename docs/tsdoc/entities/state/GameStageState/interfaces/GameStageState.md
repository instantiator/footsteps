[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [entities/state/GameStageState](../README.md) / GameStageState

# Interface: GameStageState

Defined in: [entities/state/GameStageState.ts:11](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/state/GameStageState.ts#L11)

Runtime progress through one stage of a game.

## Properties

### availability

> **availability**: [`GameStageAvailabilityState`](../type-aliases/GameStageAvailabilityState.md)

Defined in: [entities/state/GameStageState.ts:17](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/state/GameStageState.ts#L17)

Whether the stage can be entered.

***

### challengeStates

> **challengeStates**: [`GameChallengeState`](../../GameChallengeState/interfaces/GameChallengeState.md)[]

Defined in: [entities/state/GameStageState.ts:15](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/state/GameStageState.ts#L15)

Progress through each challenge in the stage, in authored order.

***

### completion

> **completion**: [`GameStageCompletionState`](../type-aliases/GameStageCompletionState.md)

Defined in: [entities/state/GameStageState.ts:19](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/state/GameStageState.ts#L19)

How much of the stage is complete.

***

### stage

> **stage**: [`GameStageData`](../../../data/GameStageData/interfaces/GameStageData.md)

Defined in: [entities/state/GameStageState.ts:13](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/state/GameStageState.ts#L13)

The authored stage this state tracks.
