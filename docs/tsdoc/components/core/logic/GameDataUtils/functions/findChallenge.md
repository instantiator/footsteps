[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/GameDataUtils](../README.md) / findChallenge

# Function: findChallenge()

> **findChallenge**(`gameData`, `stageId`, `challengeId`): [`GameChallengeData`](../../../../../entities/data/GameChallengeData/interfaces/GameChallengeData.md)

Defined in: [components/core/logic/GameDataUtils.ts:11](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/components/core/logic/GameDataUtils.ts#L11)

Looks up a challenge's definition in the game data.

## Parameters

### gameData

[`GameData`](../../../../../entities/data/GameData/interfaces/GameData.md)

### stageId

`string`

### challengeId

`string`

## Returns

[`GameChallengeData`](../../../../../entities/data/GameChallengeData/interfaces/GameChallengeData.md)

## Throws

if the stage, or the challenge within it, doesn't exist
