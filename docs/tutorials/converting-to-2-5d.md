# Converting a scene to 2.5D

A game made before 2.5D scenes existed lays its scenes out flat, in 2D. This tutorial moves one onto the floor, as was
done for **Nanny's Magic Trifle**: its stages overview, where each stage is a stepping stone across a river. The
"before" snippets are quoted from the game as it was in git (the commits are named in each snippet's title, and
`git show` prints them); the "after" snippets are the game as it is now. The last step replaces `data-depth`, the
attribute that came before floor items, using the demo's walk-around room.

Read [a 2.5D scene](2-5d-scene.md) first: it explains floor coordinates, floor items and surfaces.

## Step 1: make the scene 2.5D

The scene mode can be set for the whole game, or for one scene ([scene and avatar
modes](../game-data.md#scene-and-avatar-modes)). Magic Trifle changed the whole game:

```json [git:6819d57^:public/game-repository.json]
"modules": {
  "scene": "2D",
```

```json [public/game-repository.json]
"modules": {
  "scene": "2.5D",
```

**Look for:** the scene now lays out in the **scene box**, a rectangle at the floor's shape, standing on the bottom of
the screen. Nothing has moved onto the floor yet: everything is still plain HTML in the box, so `%`, `cqw` and `cqh`
now measure the box rather than the screen. With `?debug=true`, the floor is outlined. A player using the camera is
now asked to [calibrate the floor](../camera-mode.md#calibrating-the-floor) before playing.

## Step 2: stand things on the floor

Decide which elements stand on the floor: here, the stepping stones. Each gets `data-floor-y`, how far forward it
stands, from 0 at the back to 100 at the front ([floor-placed items](../game-data.md#floor-placed-items)).

<!-- prettier-ignore -->
```html [git:6819d57^:public/games/magic-trifle/overview/foreground.hbs]
<div id="stepping-stone-stage-{{stage.id}}" style="display: flex; flex-direction: column; align-items: center; justify-content: end;">
```

<!-- prettier-ignore -->
```html [public/games/magic-trifle/overview/foreground.html]
<div id="stepping-stone-stage-{{stage.id}}" data-floor-y="80" style="display: flex; flex-direction: column; align-items: center; justify-content: end;">
```

- **Without `data-floor-x`**, the item keeps the place the layout gave it across the scene box, read as a floor x. The
  stones stay in their flex row, evenly spaced, and the engine moves each onto the floor 80 units forward.
- **Size items as they'd look at the front of the floor.** The engine scales each by its distance. Sizes in `cqw` and
  `cqh` are fractions of the scene box, so they usually carry over.
- **Floor items in a challenge's foreground sort among the players**, who walk in front of and behind them. Elsewhere,
  as on this overview, they're placed and scaled, but stay behind the players.
- **Leave alone what isn't on the floor**, such as titles, messages and buttons. They stay plain HTML in the scene
  box, in front of the players in a challenge.

**Look for:** the stones stand in a row near the front of the floor, scaled for that distance.

## Step 3: fill the screen

A 2D scene's background fills the screen. In 2.5D, a scene's `backgroundStyle` fills only the scene box, so a
picture stays lined up with what stands on it, and on a screen of another shape there's room around it. Magic
Trifle's stages overview had a single river picture as its background:

```json [git:daf658a^:public/game-repository.json]
"backgroundStyle": {
  "background": "black",
  "backgroundImage": "url('{{resources.blank-river}}')",
```

It became four [surfaces](../game-data.md#floor-surfaces), drawn in the floor's perspective out to the screen's
edges, each from a piece cut out of the old picture: the river as the floor background, the near bank as the rear
wall, the forest just behind it, and the sky.

<!-- prettier-ignore -->
```html [public/games/magic-trifle/overview/background.html]
<div class="horizon-background" data-wall-distance="4" style="background: url('{{resources.river-sky}}') center / 100% 100%;"></div>
<div class="floor-background" style="background: url('{{resources.river-water}}') 0 0 / calc(var(--floor-unit) * 100) repeat;"></div>
<div class="rear-background" data-wall-distance="3" data-fill-width style="aspect-ratio: 100 / 22; background: url('{{resources.river-forest}}') left bottom / calc(var(--floor-unit) * 100) 100% repeat-x;"></div>
<div class="rear-wall" data-fill-width style="aspect-ratio: 100 / 13; background: url('{{resources.river-bank}}') left bottom / calc(var(--floor-unit) * 200) 100% repeat-x;"></div>
```

- `data-wall-distance="4"` brings the horizon close, so the sky stands just behind the forest, 3 units back, rather
  than at the default 1000.
- `--floor-unit` sizes each texture in floor units, so the water keeps one scale from the front of the floor to the
  horizon. The tiles are mirrored pictures, so they repeat without a seam.
- `data-fill-width` stretches the bank and forest to the screen's sides.

The surfaces are a background template, and the scene's background style is now plain:

```json [public/game-repository.json]
"backgroundTemplate": {
  "sourceType": "relative",
  "templateSource": "games/magic-trifle/overview/background.html"
},
"backgroundTemplateStyle": { "width": "100%", "height": "100%" },
"backgroundStyle": { "background": "black" },
```

A title or other screen that shouldn't be on a floor can use `screen-background` instead: a picture filling the
whole screen, square on. Magic Trifle's title puts a blurred copy of its picture behind the sharp one that way.

**Look for:** the river runs across the screen, whatever its shape, with the bank and forest beyond, and the stones
standing in the water. Resize the window: the surfaces still reach the edges.

## Step 4: replace `data-depth`

Before floor items, a scene marked things at a depth with `data-depth`, positioned by hand in screen terms. It no
longer does anything, and the validator fails a template that uses it:

```text
data-depth is no longer supported; give the item data-floor-y (see game-data.md)
```

The demo's walk-around room had two posts placed that way:

<!-- prettier-ignore -->
```html [git:e3b2b5f^:public/games/rules-demo/depth.hbs]
<div id="depth-far" class="demo-depth-item" data-depth="45" style="left: 12cqw; bottom: 55cqh">Far</div>
<div id="depth-near" class="demo-depth-item" data-depth="80" style="right: 12cqw; bottom: 20cqh">Near</div>
```

They became floor items. The position moved out of the style into floor coordinates, so each post stands at a floor
spot rather than at a place on the screen, which works whatever the room:

<!-- prettier-ignore -->
```html [public/games/rules-demo/depth.html]
<div id="depth-far" class="demo-depth-item" data-floor-x="20" data-floor-y="30">Far</div>
<div id="depth-near" class="demo-depth-item{{#if state.lit}} demo-depth-lit{{/if}}" data-floor-x="75" data-floor-y="80" data-floor-thickness="20">Near</div>
```

- `left`, `right` and `bottom` go: `data-floor-x` and `data-floor-y` place the item, by its bottom centre.
- `data-floor-thickness` is new: the near post's interactions only count while a camera player stands beside it.

## Step 5: check it

- `./validate-repository.sh public/game-repository.json --skip-urls` fails a template with `data-depth`, and warns of
  floor attributes in a scene that never shows in 2.5D, and of a surface attribute on a surface it doesn't shape.
- Paste a template into the scene renderer (see [the toolkit](index.md#toolkit)) to see it in 2.5D, with the same
  warnings.
- Play the scene with `?debug=true` and `?noCamera=true`: the floor is outlined, and what's off it is shaded. Debug
  also warns of the target of a foot or jump rule that no player can stand on.

## Next

- [Sample elements](sample-elements.md) and [positions, sizes and units](../positions-sizes-units.md).
- [Floor surfaces](../game-data.md#floor-surfaces) and [floor-placed items](../game-data.md#floor-placed-items).
