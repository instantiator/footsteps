import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { WEBCAMS_DOC, webcamsDoc } from "../scripts/webcams-doc";
import { WEBCAMS, webcamConfigsFor } from "../src/components/camera/Webcams";

describe("known webcams", () => {
  it("are documented exactly as the data says (regenerate with `node scripts/webcams-doc.ts`)", async () => {
    expect(await readFile(WEBCAMS_DOC, "utf8")).toBe(await webcamsDoc());
  });

  it("all have a picture size", () => {
    for (const { width, height } of WEBCAMS) {
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    }
  });

  it("are found by the label the browser gives them", () => {
    expect(
      webcamConfigsFor("Microsoft® LifeCam HD-3000 (045e:0810)").map(({ configuration }) => configuration),
    ).toEqual(["HD", "SD"]);
    expect(webcamConfigsFor("FaceTime HD Camera (1C1C:B782)")).toHaveLength(1);
    expect(webcamConfigsFor("Some other camera")).toEqual([]);
  });
});
