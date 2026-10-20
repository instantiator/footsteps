[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [util/ObjectUtils](../README.md) / resolveRelativeURL

# Function: resolveRelativeURL()

> **resolveRelativeURL**(`target`, `repositorySource`, `kind`): `string`

Defined in: [util/ObjectUtils.ts:52](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/util/ObjectUtils.ts#L52)

Resolves a target relative to where the repository lives: the repository's own directory
for a remote one, or the site for a local one.

## Parameters

### target

`string`

### repositorySource

[`GameSource`](../../../entities/GameSource/type-aliases/GameSource.md)

### kind

`string`

what the target is, for the error message (e.g. "template sources")

## Returns

`string`

## Throws

for a raw repository, which has no location to resolve against
