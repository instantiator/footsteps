# Positions, sizes and units in 2.5D scenes

A short reference for where things go in a 2.5D scene, and the names that put them there. The scene tutorials
([002.03.12](<prompts/002.03.12.prompt - scene tutorials.md>)) will cover this in full for game creators;
[game data](game-data.md#floor-surfaces) has the details of each.

## Positions, sizes and units

- **The screen** is the whole game area. **The scene box** is a rectangle at the floor's shape, as large as fits,
  standing on the screen's bottom edge and centred. In camera mode, it is the part of the camera image that holds the
  floor. A screen wider than the scene has room at the sides; a taller one has sky above.
- **Ordinary HTML** in a template lays out in the scene box. `%`, `cqw` and `cqh` are fractions of it, so `50cqw` is
  half the scene box's width on any screen. A scene's `backgroundStyle` fills the scene box too, so a background
  picture stays lined up with what is placed on it.
- **Floor coordinates** run 0–100: x from the floor's left edge to its right, y from its back to its front. They can go
  outside 0–100, behind the back edge or off to the sides.
- **Heights** (`data-floor-height`, `data-floor-depth`) and **distances** (`data-wall-distance`) are in floor units:
  100 is the floor's width.
- **Box scale.** Where the engine sizes a surface's box, it sets `--floor-unit` on it to the pixels a floor unit takes
  in the box. Size textures with it, so they keep one size across the floor and up the walls:
  `background-size: calc(var(--floor-unit) * 20)` repeats every 20 floor units. Most boxes are drawn at the floor's
  front edge's scale, where `--floor-unit` is `1cqw`; very large ones, like the floor background, are drawn smaller.
- **Floor items** (`data-floor-y` and so on) stand at a floor spot and scale with distance. **Surfaces** (the classes
  below) are drawn in the floor's perspective, and can reach past the scene box to the screen's edges. Everything else
  is plain 2D in the scene box.

## Scene elements

| Class or attribute                                       | Applies to                          | Meaning                                                                                                              |
| -------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `data-floor-y`, `data-floor-x`                           | any element                         | Stands the element on that floor spot. x defaults to where the layout put it across the scene box.                   |
| `data-floor-height`                                      | floor item                          | How high its anchor sits above the floor, in floor units; it shrinks with distance.                                  |
| `data-floor-anchor`                                      | floor item                          | Which point of the element stands on the spot (default `center bottom`).                                             |
| `data-floor-thickness`                                   | floor item                          | The depth of floor it covers, for feet interactions.                                                                 |
| `data-floor-area="left back right front"`                | any element                         | Lays the element flat on that floor rectangle. Feet count only where it's drawn. `"0 0 100 100"` is the floor.       |
| `screen-background`                                      | class                               | Fills the whole screen, square on, behind everything. For a scene with no floor or horizon.                          |
| `horizon-background`                                     | class                               | The furthest backdrop: upright, filling the screen above it. The floor background stops at it.                       |
| `floor-background`                                       | class                               | The endless floor plane, across the screen, from the bottom back to the horizon.                                     |
| `data-floor-depth`                                       | `floor-background`                  | How far below the floor the plane lies (default 0).                                                                  |
| `rear-background`, `left-background`, `right-background` | class                               | Upright backdrops further out, behind the walls (default distance 50).                                               |
| `rear-wall`, `left-wall`, `right-wall`, `front-wall`     | class                               | Upright surfaces on the floor's edges.                                                                               |
| `data-wall-distance`                                     | walls, backgrounds, horizon         | How far out from the floor's edge it stands, in floor units (horizon default 1000).                                  |
| `data-floor-height`                                      | walls, backgrounds                  | Fixes its height. Otherwise its box's shape sets it: a box a tenth as high as it is wide makes a wall 10 units high. |
| `data-fill-height`                                       | walls, backgrounds                  | Stretches it up to the screen's top.                                                                                 |
| `data-fill-width`                                        | rear or front wall, rear background | Stretches it sideways to the screen's edges.                                                                         |
| `data-fill-edge="near\|far"`                             | side walls and backgrounds          | With `data-fill-height`, which end reaches the top (default `far`, which never leaves a gap).                        |
| `noClicks`                                               | class, any wrapper                  | Lets the pointer through to what's beneath; its children still take it.                                              |

Surfaces paint back to front: the screen background, the horizon, the floor background, the backgrounds, floor areas,
then walls.
