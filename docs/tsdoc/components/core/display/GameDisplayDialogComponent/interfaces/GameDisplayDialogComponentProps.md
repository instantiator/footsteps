[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/display/GameDisplayDialogComponent](../README.md) / GameDisplayDialogComponentProps

# Interface: GameDisplayDialogComponentProps

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:22](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L22)

Props for [GameDisplayDialogComponent](../functions/default.md).

## Properties

### challengeId?

> `optional` **challengeId?**: `string`

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:42](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L42)

Challenge that answers are submitted to.

***

### containerStyle?

> `optional` **containerStyle?**: `CSSProperties`

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:30](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L30)

Style for the layer's container: the image (background) or the text column (foreground).

***

### contents

> **contents**: [`GameDisplayPageData`](../../../../../entities/data/displays/GameDisplayDialogComponentData/interfaces/GameDisplayPageData.md)[]

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:36](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L36)

The pages of text, with their optional audio and answer input.

***

### image?

> `optional` **image?**: `string`

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:24](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L24)

URL of the background image. Without one, the dialog fills its display.

***

### layerHint

> **layerHint**: [`LayerHint`](../../GameDisplayComponent/type-aliases/LayerHint.md)

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:38](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L38)

Whether to render the image (background) or the text and controls (foreground).

***

### margins?

> `optional` **margins?**: [`GameDisplayDialogMargins`](../../../../../entities/data/displays/GameDisplayDialogComponentData/interfaces/GameDisplayDialogMargins.md)

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:26](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L26)

Where the text sits on the image.

***

### onAnswer?

> `optional` **onAnswer?**: [`GameAnswerFunction`](../../../Game/type-aliases/GameAnswerFunction.md)

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:44](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L44)

Called when the player submits an answer on a page.

***

### stageId?

> `optional` **stageId?**: `string`

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:40](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L40)

Stage of the challenge that answers are submitted to.

***

### templateData?

> `optional` **templateData?**: [`GameTemplateData`](../../../logic/RenderDataUtils/interfaces/GameTemplateData.md)

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:34](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L34)

Extra template data, which takes precedence over the page's `text` and `lines`.

***

### templateSource?

> `optional` **templateSource?**: [`GameDisplayTemplateSourceData`](../../../../../entities/data/displays/GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md)

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:28](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L28)

Overrides the default template, which shows the page's text one paragraph per line.

***

### templateStyle?

> `optional` **templateStyle?**: `CSSProperties`

Defined in: [components/core/display/GameDisplayDialogComponent.tsx:32](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/display/GameDisplayDialogComponent.tsx#L32)

Style for the rendered template.
