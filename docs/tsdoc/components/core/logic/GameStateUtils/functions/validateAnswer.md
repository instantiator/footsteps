[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/GameStateUtils](../README.md) / validateAnswer

# Function: validateAnswer()

> **validateAnswer**(`challenge`, `input`): `true` \| `string`[]

Defined in: [components/core/logic/GameStateUtils.ts:17](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/logic/GameStateUtils.ts#L17)

Validates an answer for a given challenge, applying the solution's case and whitespace rules (all on by default).

## Parameters

### challenge

[`GameChallengeData`](../../../../../entities/data/GameChallengeData/interfaces/GameChallengeData.md)

the challenge (with solution) to validate against

### input

`string`

the submitted input

## Returns

`true` \| `string`[]

true if the answer is correct, otherwise a GameChallengeAnswerValidation[] describing the failures
