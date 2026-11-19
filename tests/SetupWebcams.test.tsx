import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { GENERIC_WEBCAM, SETUP_WEBCAMS, startingWebcam } from "../src/components/setup/SetupWebcams";
import SetupPlanner from "../src/pages/SetupPlanner";
import { stubGetUserMedia } from "./helpers/permissions";

const LIFECAM = "Microsoft® LifeCam HD-3000 (045e:0810)";

const camera = (label: string): MediaDeviceInfo => ({
  deviceId: "id",
  label,
  kind: "videoinput",
  groupId: "group",
  toJSON: () => ({}),
});

const nameOf = async (query: string) => (await startingWebcam(new URLSearchParams(query))).name;

let restore: (() => void) | undefined;
afterEach(() => restore?.());

describe("the camera the planner starts with", () => {
  it("is the one the game uses, named in the query string, at its size", async () => {
    expect(await nameOf(`camera=${encodeURIComponent(LIFECAM)}&size=640x480`)).toMatch(/HD-3000 · SD/);
    expect(await nameOf(`camera=${encodeURIComponent(LIFECAM)}`)).toMatch(/HD-3000 · HD/);
  });

  it("is the generic webcam when the game's camera isn't known, or not at that size", async () => {
    expect(await nameOf("camera=Some+other+camera&size=1280x720")).toBe(GENERIC_WEBCAM.name);
    expect(await nameOf(`camera=${encodeURIComponent(LIFECAM)}&size=320x240`)).toBe(GENERIC_WEBCAM.name);
  });

  it("is otherwise the browser's default camera, at the configured size", async () => {
    const media = stubGetUserMedia();
    restore = media.restore;
    media.enumerateDevices.mockResolvedValue([camera(LIFECAM), camera("FaceTime HD Camera")]);
    expect(await nameOf("")).toMatch(/HD-3000 · HD/);
  });

  it("is the generic webcam when the browser names no camera", async () => {
    const media = stubGetUserMedia();
    restore = media.restore;
    media.enumerateDevices.mockResolvedValue([camera("")]);
    expect(await nameOf("")).toBe(GENERIC_WEBCAM.name);
  });

  it("is chosen and filled in on the page", async () => {
    render(
      <MemoryRouter initialEntries={[`/setup?camera=${encodeURIComponent(LIFECAM)}&size=1280x720`]}>
        <SetupPlanner />
      </MemoryRouter>,
    );
    const hd = SETUP_WEBCAMS.findIndex(({ name }) => name.includes("HD-3000 · HD"));
    await waitFor(() => expect(screen.getByLabelText<HTMLSelectElement>("Known webcam").value).toBe(String(hd)));
    expect(screen.getByLabelText<HTMLInputElement>(/Diagonal field of view/).value).toBe("68.5");
  });
});
