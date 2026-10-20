[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/GameDataUtils](../README.md) / findChallenge

# Function: findChallenge()

> **findChallenge**(`gameData`, `stageId`, `challengeId`): [`GameChallengeData`](../../../../../entities/data/GameChallengeData/interfaces/GameChallengeData.md)

Defined in: [components/core/logic/GameDataUtils.ts:11](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/components/core/logic/GameDataUtils.ts#L11)

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
