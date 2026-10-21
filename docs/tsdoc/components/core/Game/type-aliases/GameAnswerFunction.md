[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [components/core/Game](../README.md) / GameAnswerFunction

# Type Alias: GameAnswerFunction

> **GameAnswerFunction** = (`stageId`, `challengeId`, `answer`) => [`GameChallengeAnswerValidation`](../../../../entities/data/GameChallengeSolution/type-aliases/GameChallengeAnswerValidation.md)[] \| `true`

Defined in: [components/core/Game.tsx:30](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/Game.tsx#L30)

Submits an answer to a challenge.

## Parameters

### stageId

[`GameStageId`](../../../../entities/data/GameStageData/type-aliases/GameStageId.md)

### challengeId

[`GameChallengeId`](../../../../entities/data/GameChallengeData/type-aliases/GameChallengeId.md)

### answer

`string`

## Returns

[`GameChallengeAnswerValidation`](../../../../entities/data/GameChallengeSolution/type-aliases/GameChallengeAnswerValidation.md)[] \| `true`

true if the answer solves the challenge, otherwise the reasons it was wrong (possibly none)
