[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [entities/data/GameData](../README.md) / GameData

# Interface: GameData

Defined in: [entities/data/GameData.ts:10](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L10)

A game's authored definition: its overview displays, stages, challenges, resources and settings.

## Properties

### config?

> `optional` **config?**: `object`

Defined in: [entities/data/GameData.ts:30](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L30)

Game-wide behaviour settings.

#### autoAdvanceStages

> **autoAdvanceStages**: `boolean`

Whether to move on to the next stage automatically on completion.
Not yet implemented: never read. See docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md #3.

#### sequential

> **sequential**: `boolean`

If true (the default when `config` is omitted), each stage unlocks only after the previous one is completed.

***

### displays

> **displays**: [`GameOverviewDisplay`](../../displays/GameDisplayData/interfaces/GameOverviewDisplay.md)[]

Defined in: [entities/data/GameData.ts:14](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L14)

Overview displays (title, stages, complete), shown when no stage is active.

***

### gameContainerStyle

> **gameContainerStyle**: `CSSProperties`

Defined in: [entities/data/GameData.ts:40](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L40)

CSS applied to the element containing the whole game, e.g. fonts, colours and sizing.

***

### modules?

> `optional` **modules?**: `object`

Defined in: [entities/data/GameData.ts:25](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L25)

Optional modules to switch on for this game.

#### camera?

> `optional` **camera?**: [`CameraModuleData`](../../GameModuleData/interfaces/CameraModuleData.md)

Layers the player's camera view into the game.

***

### resources?

> `optional` **resources?**: [`GameResourceDefinitions`](GameResourceDefinitions.md)

Defined in: [entities/data/GameData.ts:18](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L18)

Named media resources, referenced by `*Resource` keys and passed to templates as `resources`.

***

### stages

> **stages**: [`GameStageData`](../../GameStageData/interfaces/GameStageData.md)[]

Defined in: [entities/data/GameData.ts:16](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L16)

The stages of the game, in order.

***

### stylesheets?

> `optional` **stylesheets?**: `string`[]

Defined in: [entities/data/GameData.ts:23](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L23)

Names of resources (keys of `resources`) that are CSS stylesheets the game needs, such as a web font;
loaded while the game is shown. Only `https:` or same-site URLs are used.

***

### title

> **title**: `string`

Defined in: [entities/data/GameData.ts:12](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L12)

Name of the game, shown to players when choosing a game.
