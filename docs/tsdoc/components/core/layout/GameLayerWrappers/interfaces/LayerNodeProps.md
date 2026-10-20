[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/layout/GameLayerWrappers](../README.md) / LayerNodeProps

# Interface: LayerNodeProps

Defined in: [components/core/layout/GameLayerWrappers.tsx:15](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L15)

Props shared by the layer wrappers. Each wrapper uses only the subset it needs, and
assumes the ones it requires are provided.

## Properties

### aspectRatio?

> `optional` **aspectRatio?**: `number`

Defined in: [components/core/layout/GameLayerWrappers.tsx:21](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L21)

The webcam video's aspect ratio, used to size the character canvas to match.

***

### cameraEnabled?

> `optional` **cameraEnabled?**: `boolean`

Defined in: [components/core/layout/GameLayerWrappers.tsx:43](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L43)

Whether the game uses the camera.

***

### characterStream?

> `optional` **characterStream?**: `MediaStream`

Defined in: [components/core/layout/GameLayerWrappers.tsx:29](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L29)

The webcam stream, shared between the camera and the character canvas.

***

### clickHandler?

> `optional` **clickHandler?**: (`event`, `layerIdOverride?`) => `void`

Defined in: [components/core/layout/GameLayerWrappers.tsx:39](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L39)

Called with clicks on elements in the layer; `layerIdOverride` replaces the layer's own id as the source.

#### Parameters

##### event

`SyntheticEvent`\<`HTMLElement`\>

##### layerIdOverride?

`string`

#### Returns

`void`

***

### debug?

> `optional` **debug?**: `boolean`

Defined in: [components/core/layout/GameLayerWrappers.tsx:37](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L37)

Whether debug aids (colour key, coloured mask) are shown.

***

### feetPositions?

> `optional` **feetPositions?**: [`FeetPositions`](../../../../camera/CameraSupport/type-aliases/FeetPositions.md)

Defined in: [components/core/layout/GameLayerWrappers.tsx:33](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L33)

Where the player's feet were last seen, for the debug overlay.

***

### layer?

> `optional` **layer?**: `string`

Defined in: [components/core/layout/GameLayerWrappers.tsx:45](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L45)

Name of the layer (overview, stage or challenges).

***

### layerHint?

> `optional` **layerHint?**: [`LayerHint`](../../../display/GameDisplayComponent/type-aliases/LayerHint.md)

Defined in: [components/core/layout/GameLayerWrappers.tsx:47](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L47)

Whether this is the layer's background or foreground.

***

### nodes?

> `optional` **nodes?**: `ReactNode`[]

Defined in: [components/core/layout/GameLayerWrappers.tsx:41](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L41)

The display components to render in the layer, one per grid column.

***

### setAspectRatio?

> `optional` **setAspectRatio?**: `Dispatch`\<`SetStateAction`\<`number` \| `undefined`\>\>

Defined in: [components/core/layout/GameLayerWrappers.tsx:23](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L23)

Lets the camera report the video's aspect ratio.

***

### setCharacterStream?

> `optional` **setCharacterStream?**: `Dispatch`\<`SetStateAction`\<`MediaStream` \| `undefined`\>\>

Defined in: [components/core/layout/GameLayerWrappers.tsx:31](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L31)

Lets the camera share its stream once the player allows it.

***

### setFeetPositions?

> `optional` **setFeetPositions?**: `Dispatch`\<`SetStateAction`\<[`FeetPositions`](../../../../camera/CameraSupport/type-aliases/FeetPositions.md)\>\>

Defined in: [components/core/layout/GameLayerWrappers.tsx:35](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L35)

Lets the character canvas report the feet positions.

***

### setVideo?

> `optional` **setVideo?**: `Dispatch`\<`SetStateAction`\<`HTMLVideoElement` \| `null`\>\>

Defined in: [components/core/layout/GameLayerWrappers.tsx:27](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L27)

Lets the camera share its video element.

***

### style?

> `optional` **style?**: `CSSProperties`

Defined in: [components/core/layout/GameLayerWrappers.tsx:19](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L19)

Extra style for the layer's container.

***

### video?

> `optional` **video?**: `HTMLVideoElement` \| `null`

Defined in: [components/core/layout/GameLayerWrappers.tsx:25](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L25)

The webcam's video element, shared between the camera and the character canvas.

***

### zIndex

> **zIndex**: `number`

Defined in: [components/core/layout/GameLayerWrappers.tsx:17](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/layout/GameLayerWrappers.tsx#L17)

Stacking order of the layer; see `GameLayersLayout`.
