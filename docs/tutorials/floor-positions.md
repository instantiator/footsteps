# Using players' floor positions

In a 2.5D scene, the game knows where each player stands on the floor, in [floor coordinates](2-5d-scene.md#the-floor).
Rules and templates can use it: to draw something under a player, to show where they are, or to react when they reach
part of the room. This tutorial adds a ring that follows the player around the **Demo scenes** game's
"Walk around" room, and a line of text saying where they stand. Every snippet is quoted from
`public/games/rules-demo/`.

Start from [a 2.5D scene](2-5d-scene.md), which builds the room.

## Where a player stands

`game.players.N.x` and `game.players.N.y` are where player `N` stands: x from 0 at the floor's left edge to 100 at its
right, and y from 0 at the back to 100 at the front ([where players stand](../player-tracking.md#where-players-stand)).
A player off the floor gets values outside 0–100. In a 2D scene, they're percentages of the scene instead.

The position comes from the bottom of the player's silhouette, so it works from behind, and holds still through a
jump ([player positions](../camera-mode.md#player-positions)). A player who hasn't been seen has no entry at all.

## Step 1: show the position

Templates see the same values as rules, under `game`. Test for the player before using them:

<!-- prettier-ignore -->
```html [public/games/rules-demo/depth.html]
<p id="depth-position" class="noClicks demo-depth-position">
  {{#if game.players.[1]}}Player 1 is at {{game.players.[1].x}} across, {{game.players.[1].y}} forward{{else}}Nobody is on the floor yet{{/if}}
</p>
```

Handlebars needs `game.players.[1]`, in brackets, for a number as a name; rules write it `game.players.1`.

**Look for:** open the walk-around with `?noCamera=true`. "Nobody is on the floor yet" until the pointer moves over
the floor; then "Player 1 is at 77.5 across, 77.5 forward", or wherever you are.

## Step 2: quantised and rate-limited

Move the pointer slowly, and the numbers jump in steps of 5, always ending in 2.5 or 7.5. Positions in rules and
templates are deliberately coarse, so that templates don't redraw on every camera frame:

- **Quantised** to a grid of 5 floor units (20 by 20 cells across the floor), and given as the centre of the cell.
- **With hysteresis**: a position moves to the next cell only once it's a quarter of a cell past the edge, so a player
  standing on a boundary doesn't flicker between two.
- **Rate-limited** to 10 updates a second, and every player's position changes at once.

`positionCellSize` and `positionUpdatesPerSecond` change these ([configuration](../configuration.md)). The engine's
own uses, such as sorting players among floor items and checking thickness, use the exact position every frame.

## Step 3: something that follows the player

A position can go straight into a floor item's coordinates. The ring is a floor item under player 1, anchored at its
centre so it's centred on their spot:

<!-- prettier-ignore -->
```html [public/games/rules-demo/depth.html]
{{#if game.players.[1]}}
<div id="depth-ring" class="demo-depth-ring" data-floor-x="{{game.players.[1].x}}" data-floor-y="{{game.players.[1].y}}" data-floor-anchor="center"></div>
{{/if}}
```

```css [public/games/rules-demo/rules-demo.css]
/* A ring on the floor under player 1, following their position */
.demo-depth-ring {
  position: absolute;
  left: 0;
  top: 0;
  width: 14cqw;
  height: 5cqw;
  border: 0.4rem solid #ffd166;
  border-radius: 50%;
  box-sizing: border-box;
}
```

The ring has an `id`, so each new position patches the same element rather than drawing a new one
([elements that animate](../game-data.md#elements-that-animate-or-keep-state)). Give it a CSS `transition` on
`translate` and `scale` to glide between cells instead of stepping.

**Look for:** a yellow ring under the pointer, moving in steps, and smaller towards the back of the floor.

## Step 4: in rules

In a rule, the same values make conditions about where players stand. A `when` rule fires as its expression turns
true, so this one fires once as player 1 comes near the front of the floor:

```json
{
  "on": { "when": "game.players.1.y > 80" },
  "do": [{ "set": { "nearTheFront": "true" } }]
}
```

`exists(game.players.1)` tests whether player 1 has a position yet. Expressions can do arithmetic on positions, such
as the distance between two players; see [expressions](../game-data.md#expressions) and
[how filtrex works](../filtrex.md). A rule with `forMs` fires once the expression has stayed true that long, such as a
player standing still in one place.

## Testing without a camera

`mouse-feet` makes the pointer player 1's feet, so everything here can be tried with the mouse
([mouse-feet](../camera-mode.md#mouse-feet)):

- Moving the pointer moves player 1's position, through the same floor mapping as a camera player's.
- A drag from one element to another is a jump: it fires `jump-from` and `jump-onto`.
- There's only one player, and it has no body, so hand, head and body rules, and effects on players, don't fire.

Make it a scene's fallback with `"avatar": { "mode": "camera", "fallback": "mouse-feet" }`, as the walk-around does,
or play any camera game by mouse with `?noCamera=true`. The [scene renderer](index.md#toolkit) also plays with the
mouse as feet, though it takes HTML only, with no rules.

## Next

- [Converting a scene to 2.5D](converting-to-2-5d.md).
- [Player tracking](../player-tracking.md): how players are numbered, counted and restored.
