[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/RenderDataUtils](../README.md) / calcStageDisplay

# Function: calcStageDisplay()

> **calcStageDisplay**(`stage`, `purpose`): [`GameStageDisplay`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameStageDisplay.md) \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:187](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/logic/RenderDataUtils.ts#L187)

Gets the stage display for the given stage and purpose.

## Parameters

### stage

[`GameStageData`](../../../../../entities/data/GameStageData/interfaces/GameStageData.md)

the stage to get the display for

### purpose

`"shared"`

the purpose of the display to get

## Returns

[`GameStageDisplay`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameStageDisplay.md) \| `undefined`

a GameStageDisplay if one can be determined, or undefined if not
