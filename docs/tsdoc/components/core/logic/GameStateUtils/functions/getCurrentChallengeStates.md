[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/GameStateUtils](../README.md) / getCurrentChallengeStates

# Function: getCurrentChallengeStates()

> **getCurrentChallengeStates**(`chunkedChallengeStates`): [`GameChallengeState`](../../../../../entities/state/GameChallengeState/interfaces/GameChallengeState.md)[] \| `undefined`

Defined in: [components/core/logic/GameStateUtils.ts:89](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/components/core/logic/GameStateUtils.ts#L89)

Identifies the first chunk of challenge states that contains any still-active challenges.

## Parameters

### chunkedChallengeStates

[`GameChallengeState`](../../../../../entities/state/GameChallengeState/interfaces/GameChallengeState.md)[][]

the chunked challenge states to search through

## Returns

[`GameChallengeState`](../../../../../entities/state/GameChallengeState/interfaces/GameChallengeState.md)[] \| `undefined`

the first chunk containing any active challenges, or undefined if all are complete
