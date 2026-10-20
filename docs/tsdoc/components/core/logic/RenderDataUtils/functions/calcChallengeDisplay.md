[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/RenderDataUtils](../README.md) / calcChallengeDisplay

# Function: calcChallengeDisplay()

> **calcChallengeDisplay**(`challengeState`): [`GameChallengeDisplay`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameChallengeDisplay.md) \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:212](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L212)

Gets the challenge display for the given challenge state: the first it has of title, in-progress and
completed while unsolved, or of completed, in-progress and title once solved.

## Parameters

### challengeState

[`GameChallengeState`](../../../../../entities/state/GameChallengeState/interfaces/GameChallengeState.md)

the state of the challenge to get the display for

## Returns

[`GameChallengeDisplay`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameChallengeDisplay.md) \| `undefined`

a GameChallengeDisplay if one can be determined, or undefined if not
