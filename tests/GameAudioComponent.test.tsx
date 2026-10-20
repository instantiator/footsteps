import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GameAudioComponent from "../src/components/core/display/GameAudioComponent";
import type { GameDisplayMediaData } from "../src/entities/data/displays/GameDisplayMediaData";
import { GameDataProvider } from "../src/providers/GameDataProvider";
import GameRepositoryProvider from "../src/providers/GameRepositoryProvider";
import { GameMusicContext, type CurrentMusicContext } from "../src/providers/GameMusicContext";
import { getBaseURL } from "../src/util/ObjectUtils";
import { SMALL_GAME_ID, smallRepository } from "./data/SmallGame";
import { stubMediaPlayback } from "./helpers/media";

const media: GameDisplayMediaData = {
  type: "audio",
  resource: "sound",
  stillImageResource: "still-image",
  motionImageResource: "motion-image",
  audioDescription: "the bells",
};

const stopMusic = vi.fn<CurrentMusicContext["stopMusic"]>();
const music: CurrentMusicContext = { currentMusic: undefined, playMusic: () => true, stopMusic };

const Wrapper = ({ children }: { children: ReactNode }) => (
  <GameRepositoryProvider source={{ type: "RawRepository", repository: smallRepository }}>
    <GameDataProvider id={SMALL_GAME_ID}>
      <GameMusicContext.Provider value={music}>{children}</GameMusicContext.Provider>
    </GameDataProvider>
  </GameRepositoryProvider>
);

let playback: ReturnType<typeof stubMediaPlayback>;
beforeEach(() => {
  playback = stubMediaPlayback();
});
afterEach(() => {
  vi.restoreAllMocks();
  stopMusic.mockClear();
});

describe("GameAudioComponent", () => {
  it("plays the audio file the resource name refers to", () => {
    const { container } = render(<GameAudioComponent media={media} controls={false} />, { wrapper: Wrapper });
    const expected = new URL("games/magic-trifle/bells.mp3", getBaseURL()).toString();
    expect(container.querySelector("source")).toHaveAttribute("src", expected);
  });

  it("shows the still image to click before playing, and no stop button", () => {
    render(<GameAudioComponent media={media} controls={false} />, { wrapper: Wrapper });
    expect(screen.getByRole("button", { name: "Play the bells" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop the bells" })).toBeNull();
  });

  it("stops any music and plays the audio when the still image is clicked", () => {
    render(<GameAudioComponent media={media} controls={false} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole("button", { name: "Play the bells" }));
    expect(stopMusic).toHaveBeenCalledOnce();
    expect(playback.play).toHaveBeenCalledOnce();
  });

  it("swaps to the motion image's stop button once playing, and back when paused", () => {
    const { container } = render(<GameAudioComponent media={media} controls={false} />, { wrapper: Wrapper });
    const audio = container.querySelector("audio")!;

    fireEvent.play(audio);
    expect(screen.getByRole("button", { name: "Stop the bells" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play the bells" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Stop the bells" }));
    expect(playback.pause).toHaveBeenCalledOnce();

    fireEvent.pause(audio);
    expect(screen.getByRole("button", { name: "Play the bells" })).toBeInTheDocument();
  });

  it("describes itself as 'audio' when no description is given", () => {
    render(<GameAudioComponent media={{ ...media, audioDescription: undefined }} controls={false} />, {
      wrapper: Wrapper,
    });
    expect(screen.getByRole("button", { name: "Play audio" })).toBeInTheDocument();
  });
});
