[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [providers/GameContentCacheHook](../README.md) / default

# Function: default()

> **default**(): `object`

Defined in: [providers/GameContentCacheHook.tsx:30](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/providers/GameContentCacheHook.tsx#L30)

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
