[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/RenderDataUtils](../README.md) / calcOverviewDisplay

# Function: calcOverviewDisplay()

> **calcOverviewDisplay**(`gameState`): [`GameOverviewDisplay`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameOverviewDisplay.md) \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:176](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L176)

Selects the display for the game overview: the current overview display if one is set,
otherwise the title screen, falling back to the stages overview.

## Parameters

### gameState

[`GameState`](../../../../../entities/state/GameState/interfaces/GameState.md)

## Returns

[`GameOverviewDisplay`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameOverviewDisplay.md) \| `undefined`
