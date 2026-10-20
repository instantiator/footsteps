[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/GameStateUtils](../README.md) / getChunkedChallengeStates

# Function: getChunkedChallengeStates()

> **getChunkedChallengeStates**(`stageState`): [`GameChallengeState`](../../../../../entities/state/GameChallengeState/interfaces/GameChallengeState.md)[][]

Defined in: [components/core/logic/GameStateUtils.ts:78](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/GameStateUtils.ts#L78)

Chunks the challenge states for a given stage state according to its challengeChunking setting.

## Parameters

### stageState

[`GameStageState`](../../../../../entities/state/GameStageState/interfaces/GameStageState.md)

the stage state containing challenges to chunk

## Returns

[`GameChallengeState`](../../../../../entities/state/GameChallengeState/interfaces/GameChallengeState.md)[][]

an array of arrays, each containing one or more GameChallengeStates
