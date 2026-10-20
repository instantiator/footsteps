[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [providers/GameContentCacheHook](../README.md) / default

# Function: default()

> **default**(): `object`

Defined in: [providers/GameContentCacheHook.tsx:30](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/providers/GameContentCacheHook.tsx#L30)

Loads display templates, caching any fetched from a URL.

## Returns

### getTemplate

> **getTemplate**: (`template`) => `Promise`\<[`GameDisplayTemplateSourceData`](../../../entities/data/displays/GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md) \| `undefined`\>

Gets a template with its content: embedded as-is, otherwise from the cache or fetched.

#### Parameters

##### template

[`GameDisplayTemplateSourceData`](../../../entities/data/displays/GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md) \| `undefined`

#### Returns

`Promise`\<[`GameDisplayTemplateSourceData`](../../../entities/data/displays/GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md) \| `undefined`\>
