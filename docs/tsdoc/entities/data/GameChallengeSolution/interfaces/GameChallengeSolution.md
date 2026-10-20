[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [entities/data/GameChallengeSolution](../README.md) / GameChallengeSolution

# Interface: GameChallengeSolution

Defined in: [entities/data/GameChallengeSolution.ts:21](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameChallengeSolution.ts#L21)

Information about how to respond to a user's game challenge answer

## Properties

### answers

> **answers**: `string`[]

Defined in: [entities/data/GameChallengeSolution.ts:23](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameChallengeSolution.ts#L23)

One or more valid solutions for this challenge

***

### autoAccept?

> `optional` **autoAccept?**: `boolean`

Defined in: [entities/data/GameChallengeSolution.ts:38](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameChallengeSolution.ts#L38)

Automatically accept a user's input if it matches a solution, default: true.
Not yet implemented: see docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md #4.

***

### hints

> **hints**: `string`[]

Defined in: [entities/data/GameChallengeSolution.ts:44](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameChallengeSolution.ts#L44)

A series of hints, to be offered in order, if requested - leave empty for no hints.
Not yet implemented: see docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md #4.

***

### ignoreCase?

> `optional` **ignoreCase?**: `boolean`

Defined in: [entities/data/GameChallengeSolution.ts:26](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameChallengeSolution.ts#L26)

Solutions can be matched ignoring case, default: true

***

### ignoreWhitespace?

> `optional` **ignoreWhitespace?**: `boolean`

Defined in: [entities/data/GameChallengeSolution.ts:29](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameChallengeSolution.ts#L29)

Solutions can be matched ignoring whitespace, default: true

***

### trimWhitespace?

> `optional` **trimWhitespace?**: `boolean`

Defined in: [entities/data/GameChallengeSolution.ts:32](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameChallengeSolution.ts#L32)

Solutions can be matched ignoring leading and trailing whitespace, default: true
