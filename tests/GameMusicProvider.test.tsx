import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useGameMusic from "../src/providers/GameMusicHook";
import GameMusicProvider from "../src/providers/GameMusicProvider";
import { stubMediaPlayback } from "./helpers/media";

/** Exposes the music controls as buttons, and shows the current track. */
const Controls = () => {
  const { currentMusic, playMusic, stopMusic } = useGameMusic();
  return (
    <>
      <button onClick={() => playMusic("track.mp3")}>play</button>
      <button onClick={() => playMusic("next.mp3")}>play next</button>
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
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const renderControls = () =>
  render(
    <GameMusicProvider>
      <Controls />
    </GameMusicProvider>,
  );

const startTrack = async () => {
  fireEvent.click(screen.getByRole("button", { name: "play" }));
  await screen.findByText("now playing: track.mp3");
};

/** The audio element the nth play() call was made on. */
const playedAudio = (call: number): HTMLMediaElement => {
  const audio = playback.play.mock.contexts[call];
  if (!(audio instanceof HTMLMediaElement)) throw new Error(`play() call ${call} was not on a media element`);
  return audio;
};

/** Starts a track, then asks for another, and runs the whole fade-out. */
const replaceTrack = async () => {
  renderControls();
  await startTrack();
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "play next" }));
  await act(() => vi.advanceTimersByTimeAsync(1000));
  vi.useRealTimers();
  await screen.findByText("now playing: next.mp3");
};

describe("GameMusicProvider", () => {
  it("plays a track and records it as current", async () => {
    renderControls();
    expect(screen.getByText("now playing: nothing")).toBeInTheDocument();
    await startTrack();
    expect(playback.play).toHaveBeenCalledOnce();
  });

  it("fades the current track out over a second, then replaces it", async () => {
    const volumes = vi.spyOn(HTMLMediaElement.prototype, "volume", "set");
    renderControls();
    await startTrack();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "play next" }));

    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(playback.pause).not.toHaveBeenCalled();
    expect(playback.play).toHaveBeenCalledOnce();
    expect(volumes.mock.calls.at(-1)?.[0]).toBeCloseTo(0.5);

    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(playback.pause).toHaveBeenCalledOnce();
    expect(playback.play).toHaveBeenCalledTimes(2);
    expect(volumes.mock.calls.at(-1)?.[0]).toBe(1); // restored for any replay

    vi.useRealTimers();
    expect(await screen.findByText("now playing: next.mp3")).toBeInTheDocument();
  });

  it("keeps the replacement current when the replaced track's pause event arrives", async () => {
    await replaceTrack();
    act(() => {
      fireEvent.pause(playedAudio(0));
    });
    expect(screen.getByText("now playing: next.mp3")).toBeInTheDocument();
  });

  it("stops the current track by pausing it", async () => {
    renderControls();
    await startTrack();

    fireEvent.click(screen.getByRole("button", { name: "stop" }));
    expect(playback.pause).toHaveBeenCalledOnce();
  });

  it.each(["pause track", "end track"])("clears the current track when it is stopped (%s)", async (action) => {
    renderControls();
    await startTrack();

    act(() => screen.getByRole("button", { name: action }).click());
    expect(screen.getByText("now playing: nothing")).toBeInTheDocument();

    await startTrack();
    expect(playback.play).toHaveBeenCalledTimes(2);
  });

  it("does nothing when stopping with nothing playing", () => {
    renderControls();
    fireEvent.click(screen.getByRole("button", { name: "stop" }));
    expect(playback.pause).not.toHaveBeenCalled();
  });

  it("stops the music when the game unmounts", async () => {
    const { unmount } = renderControls();
    await startTrack();

    unmount();
    expect(playback.pause).toHaveBeenCalledOnce();
    expect(playback.pause.mock.contexts[0]).toBe(playedAudio(0));
  });

  it("plays only the latest of two tracks asked for during a fade", async () => {
    renderControls();
    await startTrack();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "play" }));
    fireEvent.click(screen.getByRole("button", { name: "play next" }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    vi.useRealTimers();

    await screen.findByText("now playing: next.mp3");
    expect(playback.play).toHaveBeenCalledTimes(2); // the first track, then only the latest request
  });

  it("does not record a track that fails to play", async () => {
    playback.play.mockRejectedValue(new Error("blocked"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderControls();
    fireEvent.click(screen.getByRole("button", { name: "play" }));
    await vi.waitFor(() => expect(playback.play).toHaveBeenCalled());
    expect(screen.getByText("now playing: nothing")).toBeInTheDocument();
  });
});
