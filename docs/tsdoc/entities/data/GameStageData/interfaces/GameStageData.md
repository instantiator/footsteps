[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [entities/data/GameStageData](../README.md) / GameStageData

# Interface: GameStageData

Defined in: [entities/data/GameStageData.ts:11](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/GameStageData.ts#L11)

Describes a game stage - including its displays, and the challenges it contains.
A stage may contain more than one challenge, and may group its challenges together.

## Properties

### challengeChunking?

> `optional` **challengeChunking?**: `number`

Defined in: [entities/data/GameStageData.ts:19](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/GameStageData.ts#L19)

How many challenges to show together at once in the stage layout. Default: 1.

***

### challenges

> **challenges**: [`GameChallengeData`](../../GameChallengeData/interfaces/GameChallengeData.md)[]

Defined in: [entities/data/GameStageData.ts:22](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/GameStageData.ts#L22)

The challenges in this stage, in the order they are presented.

***

### displays?

> `optional` **displays?**: [`GameStageDisplay`](../../displays/GameDisplayData/interfaces/GameStageDisplay.md)[]

Defined in: [entities/data/GameStageData.ts:16](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/GameStageData.ts#L16)

Displays shown behind this stage's challenges (purpose `shared`). Optional.

***

### id

> **id**: `string`

Defined in: [entities/data/GameStageData.ts:13](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/GameStageData.ts#L13)

Unique id for this stage, referenced by `clickIdToStageId` in overview displays.
