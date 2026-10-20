[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/TemplateUtils](../README.md) / summariseTemplateSource

# Function: summariseTemplateSource()

> **summariseTemplateSource**(`source`, `fallbackId`): `string`

Defined in: [components/core/logic/TemplateUtils.ts:45](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/TemplateUtils.ts#L45)

A readable, stable id for a template's container: its source type and location, or the
given fallback (a React useId(), so it matches between the prerendered HTML and the browser).

## Parameters

### source

[`GameDisplayTemplateSourceData`](../../../../../entities/data/displays/GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md) \| `undefined`

### fallbackId

`string`

## Returns

`string`
