[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [entities/data/GameData](../README.md) / GameData

# Interface: GameData

Defined in: [entities/data/GameData.ts:10](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/data/GameData.ts#L10)

A game's authored definition: its overview displays, stages, challenges, resources and settings.

## Properties

### config?

> `optional` **config?**: `object`

Defined in: [entities/data/GameData.ts:25](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/data/GameData.ts#L25)

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

Defined in: [entities/data/GameData.ts:14](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/data/GameData.ts#L14)

Overview displays (title, stages, complete), shown when no stage is active.

***

### gameContainerStyle

> **gameContainerStyle**: `CSSProperties`

Defined in: [entities/data/GameData.ts:35](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/data/GameData.ts#L35)

CSS applied to the element containing the whole game, e.g. fonts, colours and sizing.

***

### modules?

> `optional` **modules?**: `object`

Defined in: [entities/data/GameData.ts:20](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/data/GameData.ts#L20)

Optional modules to switch on for this game.

#### camera?

> `optional` **camera?**: [`CameraModuleData`](../../GameModuleData/interfaces/CameraModuleData.md)

Layers the player's camera view into the game.

***

### resources?

> `optional` **resources?**: [`GameResourceDefinitions`](GameResourceDefinitions.md)

Defined in: [entities/data/GameData.ts:18](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/data/GameData.ts#L18)

Named media resources, referenced by `*Resource` keys and passed to templates as `resources`.

***

### stages

> **stages**: [`GameStageData`](../../GameStageData/interfaces/GameStageData.md)[]

Defined in: [entities/data/GameData.ts:16](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/data/GameData.ts#L16)

The stages of the game, in order.

***

### title

> **title**: `string`

Defined in: [entities/data/GameData.ts:12](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/data/GameData.ts#L12)

Name of the game, shown to players when choosing a game.
