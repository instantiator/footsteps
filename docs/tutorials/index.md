# Tutorials

These tutorials show how to put a game's pieces together into scenes. Each one builds a real scene from a game in this
repository, a step at a time, so what you read is what plays. The reference docs say what each attribute, class and
rule does; the tutorials link to them rather than repeat them.

They are for game authors: you'll edit HTML, CSS and JSON, but you won't need to read Footsteps' code.

| Tutorial                                             | Covers                                                                                 | Built on             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------- |
| [Your first game](your-first-game.md)                | The repository file, a landing tile, stages and challenges, scenes, resources          | Demo (no camera)     |
| [A scene without a camera](scene-without-camera.md)  | The `mouse` avatar, clickable elements, rules and state, dialogs and scrolls           | Demo (no camera)     |
| [A 2D scene](2d-scene.md)                            | The camera in 2D: players between background and foreground, body parts, jumps, timers | Jump and duck (2D)   |
| [A 2.5D scene](2-5d-scene.md)                        | The floor: floor items, depth, floor areas, walls, backgrounds and the sky             | Demo scenes (2.5D)   |
| [Using players' floor positions](floor-positions.md) | Where players stand, in rules and templates, and `mouse-feet` for testing              | Demo scenes (2.5D)   |
| [Converting a scene to 2.5D](converting-to-2-5d.md)  | Moving an existing scene onto the floor, and replacing `data-depth`                    | Nanny's Magic Trifle |

Start with "Your first game"; the others build on it.

## Toolkit

- [Sample elements](sample-elements.md): copy-and-paste HTML for each part of a 2.5D scene, with how it looks.
- [Positions, sizes and units](../positions-sizes-units.md): how a 2.5D scene measures things, with examples, and
  every class and attribute.
- **The scene renderer**, at `/scene-renderer` in the app (<https://instantiator.dev/footsteps/scene-renderer>, or
  <http://localhost:5173/scene-renderer> when running locally): paste a scene's HTML on the left, and see it on the
  right as it would play, in 2.5D with your mouse as the player's feet. It lists what the validator would say about the
  HTML underneath it.
