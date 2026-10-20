import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useGameMusic from "../src/providers/GameMusicHook";
import GameMusicProvider from "../src/providers/GameMusicProvider";
import { stubMediaPlayback } from "./helpers/media";

/** Exposes the music controls as buttons, recording what playMusic returned. */
const Controls = ({ results }: { results: boolean[] }) => {
  const { currentMusic, playMusic, stopMusic } = useGameMusic();
  return (
    <>
      <button onClick={() => results.push(playMusic("track.mp3"))}>play</button>
      <button onClick={stopMusic}>stop</button>
      <p>{`now playing: ${currentMusic?.resource ?? "nothing"}`}</p>
      <button onClick={() => currentMusic && fireEvent.pause(currentMusic.audio)}>pause track</button>
      <button onClick={() => currentMusic && fireEvent.ended(currentMusic.audio)}>end track</button>
    </>
  );
};

let playback: ReturnType<typeof stubMediaPlayback>;
beforeEach(() => {
  playback = stubMediaPlayback();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const renderControls = () => {
  const results: boolean[] = [];
  render(
    <GameMusicProvider>
      <Controls results={results} />
    </GameMusicProvider>,
  );
  return results;
};

const startTrack = async (results: boolean[]) => {
  fireEvent.click(screen.getByRole("button", { name: "play" }));
  await screen.findByText("now playing: track.mp3");
  expect(results).toEqual([true]);
};

describe("GameMusicProvider", () => {
  it("plays a track and records it as current", async () => {
    const results = renderControls();
    expect(screen.getByText("now playing: nothing")).toBeInTheDocument();
    await startTrack(results);
    expect(playback.play).toHaveBeenCalledOnce();
  });

  it("refuses to start a second track while one is playing", async () => {
    const results = renderControls();
    await startTrack(results);

    fireEvent.click(screen.getByRole("button", { name: "play" }));
    expect(results).toEqual([true, false]);
    expect(playback.play).toHaveBeenCalledOnce();
  });

  it("stops the current track by pausing it", async () => {
    const results = renderControls();
    await startTrack(results);

    fireEvent.click(screen.getByRole("button", { name: "stop" }));
    expect(playback.pause).toHaveBeenCalledOnce();
  });

  it.each(["pause track", "end track"])("clears the current track when it is stopped (%s)", async (action) => {
    const results = renderControls();
    await startTrack(results);

    act(() => screen.getByRole("button", { name: action }).click());
    expect(screen.getByText("now playing: nothing")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "play" }));
    expect(results).toEqual([true, true]);
  });

  it("does nothing when stopping with nothing playing", () => {
    renderControls();
    fireEvent.click(screen.getByRole("button", { name: "stop" }));
    expect(playback.pause).not.toHaveBeenCalled();
  });

  it("does not record a track that fails to play", async () => {
    playback.play.mockRejectedValue(new Error("blocked"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const results = renderControls();
    fireEvent.click(screen.getByRole("button", { name: "play" }));
    await vi.waitFor(() => expect(playback.play).toHaveBeenCalled());
    expect(results).toEqual([true]);
    expect(screen.getByText("now playing: nothing")).toBeInTheDocument();
  });
});
