[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [components/camera/BodySegSupport](../README.md) / BodyPartData

# Interface: BodyPartData

Defined in: [components/camera/BodySegSupport.ts:10](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/components/camera/BodySegSupport.ts#L10)

A body part that the segmentation model can label, and how to show it.

## Properties

### color

> **color**: `Color`

Defined in: [components/camera/BodySegSupport.ts:14](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/components/camera/BodySegSupport.ts#L14)

The colour used for this body part in a coloured mask.

***

### description

> **description**: `string`

Defined in: [components/camera/BodySegSupport.ts:16](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/components/camera/BodySegSupport.ts#L16)

Human-readable name of the body part, for the colour key.

***

### maskValue

> **maskValue**: `number`

Defined in: [components/camera/BodySegSupport.ts:12](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/components/camera/BodySegSupport.ts#L12)

The value the segmentation mask holds for pixels of this body part.
