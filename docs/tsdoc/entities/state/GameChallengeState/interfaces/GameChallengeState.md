[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [entities/state/GameChallengeState](../README.md) / GameChallengeState

# Interface: GameChallengeState

Defined in: [entities/state/GameChallengeState.ts:6](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/state/GameChallengeState.ts#L6)

Runtime progress through one challenge.

## Properties

### attempts

> **attempts**: `string`[]

Defined in: [entities/state/GameChallengeState.ts:18](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/state/GameChallengeState.ts#L18)

Answers the player has submitted so far.
Not yet implemented: never updated. See docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md #5.

***

### challenge

> **challenge**: [`GameChallengeData`](../../../data/GameChallengeData/interfaces/GameChallengeData.md)

Defined in: [entities/state/GameChallengeState.ts:8](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/state/GameChallengeState.ts#L8)

The authored challenge this state tracks.

***

### displayPurpose

> **displayPurpose**: [`GameChallengeDisplayPurpose`](../../../data/displays/GameDisplayData/type-aliases/GameChallengeDisplayPurpose.md) \| `null`

Defined in: [entities/state/GameChallengeState.ts:13](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/state/GameChallengeState.ts#L13)

Which of the challenge's displays is showing.
Not yet implemented: always null. See docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md #5.

***

### succeeded

> **succeeded**: `boolean`

Defined in: [entities/state/GameChallengeState.ts:20](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/state/GameChallengeState.ts#L20)

Whether the player has solved the challenge.
