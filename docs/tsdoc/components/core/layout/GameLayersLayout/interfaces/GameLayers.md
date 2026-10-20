[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/layout/GameLayersLayout](../README.md) / GameLayers

# Interface: GameLayers

Defined in: [components/core/layout/GameLayersLayout.tsx:27](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/layout/GameLayersLayout.tsx#L27)

The nodes for the background and foreground of the overview, the stage, and its challenges.

## Properties

### challenges?

> `optional` **challenges?**: `object`

Defined in: [components/core/layout/GameLayersLayout.tsx:43](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/layout/GameLayersLayout.tsx#L43)

The active challenges' displays, one node per challenge.

#### backgroundLayerNodes

> **backgroundLayerNodes**: `ReactNode`[] \| `undefined`

The background half of the display.

#### foregroundLayerNodes

> **foregroundLayerNodes**: `ReactNode`[] \| `undefined`

The foreground half; only the challenges' foreground sits above the camera character.

***

### overview?

> `optional` **overview?**: `object`

Defined in: [components/core/layout/GameLayersLayout.tsx:29](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/layout/GameLayersLayout.tsx#L29)

The overview display, when no stage is open.

#### backgroundLayerNodes

> **backgroundLayerNodes**: `ReactNode`[] \| `undefined`

The background half of the display.

#### foregroundLayerNodes

> **foregroundLayerNodes**: `ReactNode`[] \| `undefined`

The foreground half; only the challenges' foreground sits above the camera character.

***

### stage?

> `optional` **stage?**: `object`

Defined in: [components/core/layout/GameLayersLayout.tsx:36](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/layout/GameLayersLayout.tsx#L36)

The open stage's shared display.

#### backgroundLayerNodes

> **backgroundLayerNodes**: `ReactNode`[] \| `undefined`

The background half of the display.

#### foregroundLayerNodes

> **foregroundLayerNodes**: `ReactNode`[] \| `undefined`

The foreground half; only the challenges' foreground sits above the camera character.
