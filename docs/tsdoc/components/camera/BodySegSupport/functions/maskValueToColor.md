[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [components/camera/BodySegSupport](../README.md) / maskValueToColor

# Function: maskValueToColor()

> **maskValueToColor**(`maskValue`, `maskType`): `Color`

Defined in: [components/camera/BodySegSupport.ts:26](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/components/camera/BodySegSupport.ts#L26)

The colour a mask value is drawn in for the given mask type; transparent for unknown values, and for
anything but hands and feet when the type is "extremities".

## Parameters

### maskValue

`number`

### maskType

`"binary"` \| `"colored"` \| `"extremities"`

## Returns

`Color`
