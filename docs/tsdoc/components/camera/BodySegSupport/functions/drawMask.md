[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [components/camera/BodySegSupport](../README.md) / drawMask

# Function: drawMask()

> **drawMask**(`video`, `segmentation`, `ctx`, `maskType`): `Promise`\<`void`\>

Defined in: [components/camera/BodySegSupport.ts:47](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/components/camera/BodySegSupport.ts#L47)

Draws the player's silhouette from the video onto the canvas, according to the mask type:
"binary" is the silhouette alone, "colored" tints it by body part, and "extremities" tints only hands and feet.

## Parameters

### video

`HTMLVideoElement` \| `null`

### segmentation

`Segmentation`[]

### ctx

`CanvasRenderingContext2D`

### maskType

`"binary"` \| `"colored"` \| `"extremities"`

## Returns

`Promise`\<`void`\>
