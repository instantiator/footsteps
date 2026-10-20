[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/display/GameTextInputComponent](../README.md) / GameTextInputComponentProps

# Interface: GameTextInputComponentProps

Defined in: [components/core/display/GameTextInputComponent.tsx:7](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/display/GameTextInputComponent.tsx#L7)

Props for [GameTextInputComponent](../functions/default.md).

## Properties

### autoSubmit?

> `optional` **autoSubmit?**: `boolean`

Defined in: [components/core/display/GameTextInputComponent.tsx:21](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/display/GameTextInputComponent.tsx#L21)

Submit on every change rather than on request. Defaults to true.

***

### challengeId?

> `optional` **challengeId?**: `string`

Defined in: [components/core/display/GameTextInputComponent.tsx:13](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/display/GameTextInputComponent.tsx#L13)

Challenge that answers are submitted to; required to submit.

***

### label?

> `optional` **label?**: `string`

Defined in: [components/core/display/GameTextInputComponent.tsx:9](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/display/GameTextInputComponent.tsx#L9)

Prompt shown above the input.

***

### onAnswer?

> `optional` **onAnswer?**: [`GameAnswerFunction`](../../../Game/type-aliases/GameAnswerFunction.md)

Defined in: [components/core/display/GameTextInputComponent.tsx:19](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/display/GameTextInputComponent.tsx#L19)

Submits an answer; nothing is submitted without it.

***

### setSolved?

> `optional` **setSolved?**: `Dispatch`\<`SetStateAction`\<`boolean`\>\>

Defined in: [components/core/display/GameTextInputComponent.tsx:17](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/display/GameTextInputComponent.tsx#L17)

Lets the input record the outcome of a submission for its parent.

***

### solved?

> `optional` **solved?**: `boolean`

Defined in: [components/core/display/GameTextInputComponent.tsx:15](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/display/GameTextInputComponent.tsx#L15)

Whether the challenge is solved; the input is then disabled and further answers ignored.

***

### stageId?

> `optional` **stageId?**: `string`

Defined in: [components/core/display/GameTextInputComponent.tsx:11](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/display/GameTextInputComponent.tsx#L11)

Stage of the challenge that answers are submitted to; required to submit.
