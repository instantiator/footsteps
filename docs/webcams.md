# Known webcams

<!-- Generated from src/components/camera/Webcams.ts by scripts/webcams-doc.ts: edit the data, not this file. -->

The webcams whose configurations are known, one row per configuration. The setup planner at `/setup` can fill in
its field of view and aspect from these, and the game's landing page offers a known camera's configurations by name.
See [camera mode](camera-mode.md) for how the camera is used.

| Camera                                                                                  | Manufacturer | Configuration | Picture dimensions | Diagonal FOV      | Aspect | Connection types | Battery                |
| --------------------------------------------------------------------------------------- | ------------ | ------------- | ------------------ | ----------------- | ------ | ---------------- | ---------------------- |
| [LifeCam HD-3000](https://www.farnell.com/datasheets/1728895.pdf)                       | Microsoft    | HD            | 1280 × 720         | 68.5° (published) | 16:9   | USB-A            | No                     |
| [LifeCam HD-3000](https://www.farnell.com/datasheets/1728895.pdf)                       | Microsoft    | SD            | 640 × 480          | ≈58° (estimated)  | 4:3    | USB-A            | No                     |
| [MacBook Pro 13-inch (M1, 2020) FaceTime HD camera](https://support.apple.com/kb/SP824) | Apple        | HD            | 1280 × 720         | Not published     | 16:9   | Built-in         | No (uses the laptop's) |

## Measuring a field of view

Where a field of view isn't published, measure it:

1. Set the camera square to a flat wall, about 1 m away, and measure the distance from the lens to the wall.
2. Open the camera at the configuration's picture size, and mark the wall where the picture's left and right edges fall.
3. Measure across between the marks, at the camera's height.
4. Enter both in `/setup`'s measured check, with the configuration's aspect: it shows the diagonal field of view.

Then add it to `src/components/camera/Webcams.ts` with `fovSource: "measured"`.
