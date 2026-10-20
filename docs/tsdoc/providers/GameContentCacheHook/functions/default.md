[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [providers/GameContentCacheHook](../README.md) / default

# Function: default()

> **default**(): `object`

Defined in: [providers/GameContentCacheHook.tsx:37](https://github.com/instantiator/2025-xmas-game/blob/main/src/providers/GameContentCacheHook.tsx#L37)

Loads display templates, fetching each URL once and sharing the result.

## Returns

### getTemplate

> **getTemplate**: (`template`) => `Promise`\<[`GameDisplayTemplateSourceData`](../../../entities/data/displays/GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md) \| `undefined`\>

Gets a template with its content: embedded as-is, otherwise fetched once per URL.

#### Parameters

##### template

[`GameDisplayTemplateSourceData`](../../../entities/data/displays/GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md) \| `undefined`

#### Returns

`Promise`\<[`GameDisplayTemplateSourceData`](../../../entities/data/displays/GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md) \| `undefined`\>
