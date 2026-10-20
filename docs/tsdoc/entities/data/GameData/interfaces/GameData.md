[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [entities/data/GameData](../README.md) / GameData

# Interface: GameData

Defined in: [entities/data/GameData.ts:39](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L39)

A game's authored definition: its overview displays, stages, challenges, resources and settings.

## Properties

### config?

> `optional` **config?**: `object`

Defined in: [entities/data/GameData.ts:77](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L77)

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

Defined in: [entities/data/GameData.ts:43](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L43)

Overview displays (title, stages, complete), shown when no stage is active.

***

### gameContainerStyle

> **gameContainerStyle**: `CSSProperties`

Defined in: [entities/data/GameData.ts:87](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L87)

CSS applied to the element containing the whole game, e.g. fonts, colours and sizing.

***

### modules?

> `optional` **modules?**: `object`

Defined in: [entities/data/GameData.ts:72](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L72)

Optional modules to switch on for this game.

#### camera?

> `optional` **camera?**: [`CameraModuleData`](../../GameModuleData/interfaces/CameraModuleData.md)

Layers the player's camera view into the game.

***

### resources?

> `optional` **resources?**: [`GameResourceDefinitions`](GameResourceDefinitions.md)

Defined in: [entities/data/GameData.ts:47](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L47)

Named media resources, referenced by `*Resource` keys and passed to templates as `resources`.

***

### reward?

> `optional` **reward?**: `object`

Defined in: [entities/data/GameData.ts:65](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L65)

The celebration shown when a stage is completed. Unset means none.

#### animation

> **animation**: [`RewardAnimation`](../type-aliases/RewardAnimation.md)

Which partycles animation to show.

#### particleCount?

> `optional` **particleCount?**: `number`

How many particles to launch (default 200).

***

### sounds?

> `optional` **sounds?**: `object`

Defined in: [entities/data/GameData.ts:54](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L54)

Music and sound effects, as resource names (keys of `resources`). Any left unset is silent.

#### closingMusicResource?

> `optional` **closingMusicResource?**: `string`

Music played on the game-complete overview.

#### openingMusicResource?

> `optional` **openingMusicResource?**: `string`

Music played when the stages overview shows.

#### stageCompletedSoundResource?

> `optional` **stageCompletedSoundResource?**: `string`

Sound effect played when a stage is completed.

#### stageOpenedSoundResource?

> `optional` **stageOpenedSoundResource?**: `string`

Sound effect played when a stage opens.

***

### stages

> **stages**: [`GameStageData`](../../GameStageData/interfaces/GameStageData.md)[]

Defined in: [entities/data/GameData.ts:45](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L45)

The stages of the game, in order.

***

### stylesheets?

> `optional` **stylesheets?**: `string`[]

Defined in: [entities/data/GameData.ts:52](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L52)

Names of resources (keys of `resources`) that are CSS stylesheets the game needs, such as a web font;
loaded while the game is shown. Only `https:` or same-site URLs are used.

***

### title

> **title**: `string`

Defined in: [entities/data/GameData.ts:41](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/GameData.ts#L41)

Name of the game, shown to players when choosing a game.
