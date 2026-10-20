[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [providers/GameContentCacheHook](../README.md) / resolveTemplateURL

# Function: resolveTemplateURL()

> **resolveTemplateURL**(`sourceType`, `templateSource`, `repositorySource`): `string`

Defined in: [providers/GameContentCacheHook.tsx:13](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/providers/GameContentCacheHook.tsx#L13)

Resolves a "local" or "relative" template source to an absolute URL for the given repository:
local sources resolve against the site, relative ones against the repository's own location.

## Parameters

### sourceType

`"local"` \| `"relative"`

### templateSource

`string`

### repositorySource

[`GameSource`](../../../entities/GameSource/type-aliases/GameSource.md)

## Returns

`string`

## Throws

if the repository type can't host that kind of source
