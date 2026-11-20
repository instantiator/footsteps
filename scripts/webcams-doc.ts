import { writeFile } from "node:fs/promises";
import { format, resolveConfig } from "prettier";
import { WEBCAMS, type WebcamConfig } from "../src/components/camera/Webcams.ts";

/** Where the generated doc lives. */
export const WEBCAMS_DOC = "docs/webcams.md";

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

const aspectOf = ({ width, height }: WebcamConfig) => `${width / gcd(width, height)}:${height / gcd(width, height)}`;

const fovOf = ({ diagonalFov, fovSource }: WebcamConfig) =>
  diagonalFov === undefined ? "Not published" : `${fovSource === "estimated" ? "≈" : ""}${diagonalFov}° (${fovSource})`;

const rowOf = (config: WebcamConfig) =>
  [
    config.specUrl ? `[${config.camera}](${config.specUrl})` : config.camera,
    config.manufacturer,
    config.configuration,
    `${config.width} × ${config.height}`,
    fovOf(config),
    aspectOf(config),
    config.connections.join(", "),
    config.battery,
  ].join(" | ");

/** `docs/webcams.md` for these webcams, formatted as the repository's prettier config would. */
export const webcamsDoc = async (webcams: readonly WebcamConfig[] = WEBCAMS): Promise<string> => {
  const markdown = `# Known webcams

<!-- Generated from src/components/camera/Webcams.ts by scripts/webcams-doc.ts: edit the data, not this file. -->

The webcams whose configurations are known, one row per configuration. The setup planner at \`/setup\` can fill in
its field of view and aspect from these, and the game's landing page offers a known camera's configurations by name.
See [camera mode](camera-mode.md) for how the camera is used.

| Camera | Manufacturer | Configuration | Picture dimensions | Diagonal FOV | Aspect | Connection types | Battery |
| --- | --- | --- | --- | --- | --- | --- | --- |
${webcams.map((config) => `| ${rowOf(config)} |`).join("\n")}

## Measuring a field of view

Where a field of view isn't published, measure it:

1. Set the camera square to a flat wall, about 1 m away, and measure the distance from the lens to the wall.
2. Open the camera at the configuration's picture size, and mark the wall where the picture's left and right edges fall.
3. Measure across between the marks, at the camera's height.
4. Enter both in \`/setup\`'s measured check, with the configuration's aspect: it shows the diagonal field of view.

Then add it to \`src/components/camera/Webcams.ts\` with \`fovSource: "measured"\`.
`;
  return format(markdown, { ...(await resolveConfig(WEBCAMS_DOC)), parser: "markdown" });
};

if (import.meta.main) await writeFile(WEBCAMS_DOC, await webcamsDoc());
