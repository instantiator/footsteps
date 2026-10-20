[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/layout/GameChallengeGrid](../README.md) / default

# Function: default()

> **default**(`__namedParameters`): `Element`

Defined in: [components/core/layout/GameChallengeGrid.tsx:7](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/components/core/layout/GameChallengeGrid.tsx#L7)

Lays a layer's challenges side by side in equal-width columns. Clicks pass through the grid
and its columns to the elements inside them.

## Parameters

### \_\_namedParameters

#### children

`ReactNode`

#### className?

`string`

#### layer

`string`

Name of the layer (overview, stage or challenges) the grid belongs to; used to build element ids.

#### layerHint

`string`

Whether the grid is in the layer's background or foreground; used to build element ids.

#### style?

`CSSProperties`

## Returns

`Element`
