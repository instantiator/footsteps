[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/RenderDataUtils](../README.md) / LayeredGameDisplayRenderData

# Interface: LayeredGameDisplayRenderData

Defined in: [components/core/logic/RenderDataUtils.ts:33](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/components/core/logic/RenderDataUtils.ts#L33)

The displays to show at once, layered: the overview, the current stage's shared display, and its active challenges.

## Properties

### challengesRenderData?

> `optional` **challengesRenderData?**: [`GameDisplayRenderData`](GameDisplayRenderData.md)[]

Defined in: [components/core/logic/RenderDataUtils.ts:39](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/components/core/logic/RenderDataUtils.ts#L39)

One per active challenge in the current chunk.

***

### overviewRenderData?

> `optional` **overviewRenderData?**: [`GameDisplayRenderData`](GameDisplayRenderData.md)

Defined in: [components/core/logic/RenderDataUtils.ts:35](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/components/core/logic/RenderDataUtils.ts#L35)

Present when no stage is current.

***

### stageRenderData?

> `optional` **stageRenderData?**: [`GameDisplayRenderData`](GameDisplayRenderData.md)

Defined in: [components/core/logic/RenderDataUtils.ts:37](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/components/core/logic/RenderDataUtils.ts#L37)

The current stage's `shared` display, if it has one.
