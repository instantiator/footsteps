Prompts listed in this directory are prefixed with a 3-part numbering system: `XXX.YYY.ZZ.<prompt|plan|feedback> - <description>.md`

- `XXX` the first part groups prompts by major themes
- `YYY` the second part is the number of the task within that theme
- `ZZ` the third part provides an ordering of prompts, plans, and feedback

eg.

- Prompt: `000.00.00.prompt - identify and clear up game specifics.md`
- Plan: `000.00.01.plan - identify and clear up game specifics.md`
- Feedback: `000.00.02.feedback - a couple more game specifics.md`
- Feedback: `000.00.03.feedback - application level font.md`

Prompts describe what's required for a plan. Feedback may lead to a plan, or may be implemented directly.

Prompt and feedback will commonly be written by a user. Plans will commonly be written by a coding agent.

Each plan should:

- Follow dev-qual guidance
- Be implemented on a new branch, prefixed with the number of the prompt, branched from the HEAD of `main`
- Be stored alongside the prompt, with a `ZZ` increment and `prompt` swapped for `plan`
