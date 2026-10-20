[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [components/camera/CameraSupport](../README.md) / findFeet

# Function: findFeet()

> **findFeet**(`personMask`, `width`, `height`, `offScreenThreshold_percent?`): [`FootPosition`](../interfaces/FootPosition.md) \| `null`

Defined in: [components/camera/CameraSupport.ts:45](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/camera/CameraSupport.ts#L45)

Locates a person's feet in a segmentation mask: the centre of the opaque pixels
in the band just above the mask's lowest opaque row.

## Parameters

### personMask

`Pick`\<`ImageData`, `"data"`\>

### width

`number`

### height

`number`

### offScreenThreshold\_percent?

`number`

feet lower than this (% of height) count as off screen

## Returns

[`FootPosition`](../interfaces/FootPosition.md) \| `null`

the feet position, or null if there is no person or they are off screen
