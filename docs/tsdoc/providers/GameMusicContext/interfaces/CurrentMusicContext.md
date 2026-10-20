[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [providers/GameMusicContext](../README.md) / CurrentMusicContext

# Interface: CurrentMusicContext

Defined in: [providers/GameMusicContext.tsx:4](https://github.com/instantiator/2025-xmas-game/blob/main/src/providers/GameMusicContext.tsx#L4)

Plays one music track at a time.

## Properties

### currentMusic

> **currentMusic**: \{ `audio`: `HTMLAudioElement`; `resource`: `string`; \} \| `undefined`

Defined in: [providers/GameMusicContext.tsx:6](https://github.com/instantiator/2025-xmas-game/blob/main/src/providers/GameMusicContext.tsx#L6)

The track now playing, if any.

#### Union Members

##### Type Literal

\{ `audio`: `HTMLAudioElement`; `resource`: `string`; \}

##### audio

> **audio**: `HTMLAudioElement`

The playing element.

##### resource

> **resource**: `string`

The URL of the track.

***

`undefined`

***

### playMusic

> **playMusic**: (`res`) => `boolean`

Defined in: [providers/GameMusicContext.tsx:15](https://github.com/instantiator/2025-xmas-game/blob/main/src/providers/GameMusicContext.tsx#L15)

Starts the track at the given URL, unless music is already playing.

#### Parameters

##### res

`string`

#### Returns

`boolean`

whether playback was attempted

***

### stopMusic

> **stopMusic**: () => `void`

Defined in: [providers/GameMusicContext.tsx:17](https://github.com/instantiator/2025-xmas-game/blob/main/src/providers/GameMusicContext.tsx#L17)

Stops the current music, if any.

#### Returns

`void`
