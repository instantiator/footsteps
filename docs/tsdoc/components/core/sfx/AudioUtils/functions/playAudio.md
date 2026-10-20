[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/sfx/AudioUtils](../README.md) / playAudio

# Function: playAudio()

> **playAudio**(`res`): `Promise`\<\{ `audio`: `HTMLAudioElement`; `resource`: `string`; \} \| `undefined`\>

Defined in: [components/core/sfx/AudioUtils.ts:5](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/components/core/sfx/AudioUtils.ts#L5)

Plays a sound effect once, fire and forget.

## Parameters

### res

`string`

## Returns

`Promise`\<\{ `audio`: `HTMLAudioElement`; `resource`: `string`; \} \| `undefined`\>

the playing audio, or undefined (after logging) if it could not play, e.g. blocked by the browser.
