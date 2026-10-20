[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/display/GameDisplayDialogComponent](../README.md) / GameDisplayDialogComponentProps

# Interface: GameDisplayDialogComponentProps

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:23](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L23)

Props for [GameDisplayDialogComponent](../functions/default.md).

## Properties

### challengeId?

> `optional` **challengeId?**: `string`

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:43](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L43)

Challenge that answers are submitted to.

***

### containerStyle?

> `optional` **containerStyle?**: `CSSProperties`

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:31](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L31)

Style for the layer's container: the image (background) or the text column (foreground).

***

### contents

> **contents**: [`GameDisplayPageData`](../../../../../entities/data/displays/GameDisplayDialogComponentData/interfaces/GameDisplayPageData.md)[]

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:37](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L37)

The pages of text, with their optional audio and answer input.

***

### image?

> `optional` **image?**: `string`

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:25](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L25)

URL of the background image. Without one, the dialog fills its display.

***

### layerHint

> **layerHint**: [`LayerHint`](../../GameDisplayComponent/type-aliases/LayerHint.md)

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:39](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L39)

Whether to render the image (background) or the text and controls (foreground).

***

### margins?

> `optional` **margins?**: [`GameDisplayDialogMargins`](../../../../../entities/data/displays/GameDisplayDialogComponentData/interfaces/GameDisplayDialogMargins.md)

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:27](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L27)

Where the text sits on the image.

***

### onAnswer?

> `optional` **onAnswer?**: [`GameAnswerFunction`](../../../Game/type-aliases/GameAnswerFunction.md)

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:47](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L47)

Called when the player submits an answer on a page.

***

### solution?

> `optional` **solution?**: [`GameChallengeSolution`](../../../../../entities/data/GameChallengeSolution/interfaces/GameChallengeSolution.md)

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:45](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L45)

The challenge's solution.

***

### stageId?

> `optional` **stageId?**: `string`

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:41](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L41)

Stage of the challenge that answers are submitted to.

***

### templateData?

> `optional` **templateData?**: [`GameTemplateData`](../../../logic/RenderDataUtils/interfaces/GameTemplateData.md)

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:35](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L35)

Extra template data, which takes precedence over the page's `text` and `lines`.

***

### templateSource?

> `optional` **templateSource?**: [`GameDisplayTemplateSourceData`](../../../../../entities/data/displays/GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md)

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:29](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L29)

Overrides the default template, which shows the page's text one paragraph per line.

***

### templateStyle?

> `optional` **templateStyle?**: `CSSProperties`

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:33](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L33)

Style for the rendered template.
