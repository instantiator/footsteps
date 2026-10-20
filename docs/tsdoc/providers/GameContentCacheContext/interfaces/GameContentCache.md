[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [providers/GameContentCacheContext](../README.md) / GameContentCache

# Interface: GameContentCache

Defined in: [providers/GameContentCacheContext.tsx:4](https://github.com/instantiator/2025-xmas-game/blob/main/src/providers/GameContentCacheContext.tsx#L4)

Content fetched during play, so each URL is only fetched once.

## Properties

### templates

> **templates**: `Map`\<`string`, `Promise`\<`string`\>\>

Defined in: [providers/GameContentCacheContext.tsx:6](https://github.com/instantiator/2025-xmas-game/blob/main/src/providers/GameContentCacheContext.tsx#L6)

Template text by URL: fetched, or still in flight, so concurrent requests share one fetch.
