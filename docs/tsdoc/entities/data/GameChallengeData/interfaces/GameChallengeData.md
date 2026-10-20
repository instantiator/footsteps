[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [entities/data/GameChallengeData](../README.md) / GameChallengeData

# Interface: GameChallengeData

Defined in: [entities/data/GameChallengeData.ts:8](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/GameChallengeData.ts#L8)

Describes an individual challenge in the game

## Properties

### displays

> **displays**: [`GameChallengeDisplay`](../../displays/GameDisplayData/interfaces/GameChallengeDisplay.md)[]

Defined in: [entities/data/GameChallengeData.ts:13](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/GameChallengeData.ts#L13)

Displays for this challenge, chosen by purpose: title, in progress, and completed.

***

### id

> **id**: `string`

Defined in: [entities/data/GameChallengeData.ts:10](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/GameChallengeData.ts#L10)

Unique id for this challenge, used when submitting and checking answers.

***

### solution

> **solution**: [`GameChallengeSolution`](../../GameChallengeSolution/interfaces/GameChallengeSolution.md)

Defined in: [entities/data/GameChallengeData.ts:16](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/GameChallengeData.ts#L16)

How the player's answer is checked for this challenge.
