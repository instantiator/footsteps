[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/RenderDataUtils](../README.md) / calcChallengeDisplay

# Function: calcChallengeDisplay()

> **calcChallengeDisplay**(`challengeState`): [`GameChallengeDisplay`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameChallengeDisplay.md) \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:205](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L205)

Gets the challenge display for the given challenge state: its set display purpose if any,
otherwise the first of title, in-progress and completed that it has.

## Parameters

### challengeState

[`GameChallengeState`](../../../../../entities/state/GameChallengeState/interfaces/GameChallengeState.md)

the state of the challenge to get the display for

## Returns

[`GameChallengeDisplay`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameChallengeDisplay.md) \| `undefined`

a GameChallengeDisplay if one can be determined, or undefined if not
