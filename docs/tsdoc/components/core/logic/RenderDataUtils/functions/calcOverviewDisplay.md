[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/RenderDataUtils](../README.md) / calcOverviewDisplay

# Function: calcOverviewDisplay()

> **calcOverviewDisplay**(`gameState`): [`GameOverviewDisplay`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameOverviewDisplay.md) \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:175](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/logic/RenderDataUtils.ts#L175)

Selects the display for the game overview: the current overview display if one is set,
otherwise the title screen, falling back to the stages overview.

## Parameters

### gameState

[`GameState`](../../../../../entities/state/GameState/interfaces/GameState.md)

## Returns

[`GameOverviewDisplay`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameOverviewDisplay.md) \| `undefined`
