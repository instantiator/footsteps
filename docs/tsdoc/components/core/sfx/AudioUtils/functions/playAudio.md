[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/sfx/AudioUtils](../README.md) / playAudio

# Function: playAudio()

> **playAudio**(`res`): `Promise`\<\{ `audio`: `HTMLAudioElement`; `resource`: `string`; \} \| `undefined`\>

Defined in: [components/core/sfx/AudioUtils.ts:5](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/sfx/AudioUtils.ts#L5)

Plays a sound effect once, fire and forget.

## Parameters

### res

`string`

## Returns

`Promise`\<\{ `audio`: `HTMLAudioElement`; `resource`: `string`; \} \| `undefined`\>

the playing audio, or undefined (after logging) if it could not play, e.g. blocked by the browser.
