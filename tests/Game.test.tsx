import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameData } from "../src/entities/data/GameData";
import Game from "../src/components/core/Game";
import type GameLayersLayout from "../src/components/core/layout/GameLayersLayout";
import { completeChallenge } from "../src/components/core/logic/GameStateUtils";
import { createBlankGameState } from "../src/entities/state/GameState";
import { saveGameState } from "../src/entities/state/GameStateStorage";
import { SMALL_GAME_ID, smallGame, smallRepository } from "./data/SmallGame";
import GameProviders from "./helpers/GameProviders";
import { stubMediaPlayback } from "./helpers/media";
import { FakeWakeLockSentinel, stubWakeLock } from "./helpers/wakeLock";

const { rewardSpy, useRewardSpy } = vi.hoisted(() => {
  const rewardSpy = vi.fn(() => Promise.resolve());
  return { rewardSpy, useRewardSpy: vi.fn(() => ({ reward: rewardSpy, isAnimating: false })) };
});
vi.mock("partycles", () => ({ useReward: useRewardSpy }));

/** The props each render gave the layout, so tests can drive its callbacks. */
const { receivedLayout } = vi.hoisted(() => ({
  receivedLayout: [] as ComponentProps<typeof GameLayersLayout>[],
}));

// Records the layout's props while rendering the real layout, leaving its behaviour intact
vi.mock("../src/components/core/layout/GameLayersLayout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/components/core/layout/GameLayersLayout")>();
  const ActualLayout = actual.default;
  return {
    ...actual,
    default: (props: ComponentProps<typeof ActualLayout>) => {
      receivedLayout.push(props);
      return <ActualLayout {...props} />;
    },
  };
});

let playback: ReturnType<typeof stubMediaPlayback>;
const wakeLockRestores: (() => void)[] = [];
beforeEach(() => {
  playback = stubMediaPlayback();
  rewardSpy.mockClear();
  receivedLayout.length = 0;
});
afterEach(() => {
  wakeLockRestores.forEach((restore) => restore());
  wakeLockRestores.length = 0;
  vi.restoreAllMocks();
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove());
});

const renderGame = () =>
  render(
    <GameProviders repository={smallRepository} gameId={SMALL_GAME_ID}>
      <Game />
    </GameProviders>,
  );

/** Opens a stage from the stages overview by clicking its link. */
const enterStage = async (n: 1 | 2) => {
  fireEvent.click(await screen.findByText(`Stage ${n}`));
  return await screen.findByText(`Question for stage-${n}`);
};

const answer = (text: string) => fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });

describe("Game", () => {
  it("shows the stages overview first, when the game has no title display", async () => {
    renderGame();
    expect(await screen.findByText("Small Game")).toBeInTheDocument();
    expect(screen.getByText("Stage 1")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("enters the stage whose link is clicked, showing its challenge", async () => {
    renderGame();
    await enterStage(1);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByText("Your answer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close challenge" })).toBeInTheDocument();
  });

  it("gives the layout a new display key when the display changes", async () => {
    renderGame();
    await screen.findByText("Small Game");
    const overviewKey = receivedLayout.at(-1)!.displayKey;
    await enterStage(1);
    expect(receivedLayout.at(-1)!.displayKey).not.toBe(overviewKey);
  });

  it("does not enter a locked stage", async () => {
    renderGame();
    fireEvent.click(await screen.findByText("Stage 2"));
    expect(screen.queryByText("Question for stage-2")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("keeps the player in the challenge, with no completion, while the answer is wrong", async () => {
    renderGame();
    await enterStage(1);
    answer("rhubarb");
    expect(screen.getByText("Question for stage-1")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeEnabled();
  });

  it("returns to the stages overview when the right answer is typed, and unlocks the next stage", async () => {
    renderGame();
    await enterStage(1);
    answer("Custard");

    expect(screen.queryByText("Question for stage-1")).toBeNull();
    expect(screen.queryByRole("button", { name: "Close challenge" })).toBeNull();
    await enterStage(2);
  });

  it("does not re-enter a completed stage", async () => {
    renderGame();
    await enterStage(1);
    answer("custard");
    fireEvent.click(await screen.findByText("Stage 1"));
    expect(screen.queryByText("Question for stage-1")).toBeNull();
  });
});

describe("Game camera interactions", () => {
  /** A variant of the small game whose first stage opens on a hand wave instead of a click. */
  const handGame: GameData = {
    ...smallGame,
    displays: smallGame.displays.map((display) =>
      display.purpose === "game-overview-stages"
        ? {
            ...display,
            clickIdToStageId: {
              ...display.clickIdToStageId,
              "stage-link-stage-1": { stage: "stage-1", interactions: ["hand"] },
            },
          }
        : display,
    ),
  };

  const renderVariant = (game: GameData) =>
    render(
      <GameProviders repository={{ games: { [SMALL_GAME_ID]: game } }} gameId={SMALL_GAME_ID}>
        <Game />
      </GameProviders>,
    );

  /** The interaction callback the layout was last given. */
  const layoutInteraction = () => receivedLayout.at(-1)!.onPlayerInteraction!;

  it("enters the stage a camera interaction names", async () => {
    renderVariant(handGame);
    await screen.findByText("Small Game");

    act(() => layoutInteraction()({ elementId: "stage-link-stage-1", interaction: "hand" }));

    expect(await screen.findByText("Question for stage-1")).toBeInTheDocument();
  });

  it("ignores a camera interaction on an element that only accepts clicks", async () => {
    renderGame();
    await screen.findByText("Small Game");

    act(() => layoutInteraction()({ elementId: "stage-link-stage-1", interaction: "hand" }));

    expect(screen.queryByText("Question for stage-1")).toBeNull();
    expect(screen.getByText("Stage 1")).toBeInTheDocument();
  });
});

describe("Game stylesheets", () => {
  const FONT_URL = "https://fonts.example/font.css";
  const gameLink = (href: string) => document.head.querySelector(`link[rel="stylesheet"][href="${href}"]`);

  const renderWithStylesheet = (target?: string) =>
    render(
      <GameProviders
        repository={{
          games: {
            [SMALL_GAME_ID]: {
              ...smallGame,
              resources: { ...smallGame.resources, ...(target && { "the-css": { type: "url", target } }) },
              stylesheets: target ? ["the-css"] : undefined,
            },
          },
        }}
        gameId={SMALL_GAME_ID}
      >
        <Game />
      </GameProviders>,
    );

  it("loads an https stylesheet named by the game into the document head", async () => {
    renderWithStylesheet(FONT_URL);
    await vi.waitFor(() => expect(gameLink(FONT_URL)).not.toBeNull());
  });

  it("adds no stylesheet when the game names none", async () => {
    renderWithStylesheet();
    await screen.findByText("Small Game");
    expect(gameLink(FONT_URL)).toBeNull();
  });

  it("skips, with a warning, a stylesheet that is neither https nor same-site", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderWithStylesheet("http://other.example/x.css");
    await screen.findByText("Small Game");
    expect(gameLink("http://other.example/x.css")).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});

describe("Game sounds and reward", () => {
  const sounds = {
    openingMusicResource: "opening",
    stageOpenedSoundResource: "opened",
    stageCompletedSoundResource: "completed",
  };
  const withAudio: GameData = {
    ...smallGame,
    resources: {
      ...smallGame.resources,
      opening: { type: "url", target: "https://sounds.example/opening.mp3" },
      opened: { type: "url", target: "https://sounds.example/opened.mp3" },
      completed: { type: "url", target: "https://sounds.example/completed.mp3" },
    },
  };

  const renderVariant = (game: GameData) =>
    render(
      <GameProviders repository={{ games: { [SMALL_GAME_ID]: game } }} gameId={SMALL_GAME_ID}>
        <Game />
      </GameProviders>,
    );

  /** The src of every media element that has been played. */
  const playedSources = () =>
    playback.play.mock.contexts.map((audio) => (audio instanceof HTMLMediaElement ? audio.src : ""));

  it("plays the opening music on the stages overview", async () => {
    renderVariant({ ...withAudio, sounds });
    await screen.findByText("Small Game");
    await vi.waitFor(() => expect(playedSources()).toContain("https://sounds.example/opening.mp3"));
  });

  it("plays the stage opened sound when a stage opens", async () => {
    renderVariant({ ...withAudio, sounds });
    await enterStage(1);
    await vi.waitFor(() => expect(playedSources()).toContain("https://sounds.example/opened.mp3"));
  });

  it("plays the stage completed sound when a stage is completed", async () => {
    renderVariant({ ...withAudio, sounds });
    await enterStage(1);
    answer("custard");
    await vi.waitFor(() => expect(playedSources()).toContain("https://sounds.example/completed.mp3"));
  });

  it("plays nothing when the game has no sounds", async () => {
    renderVariant(withAudio);
    await enterStage(1);
    answer("custard");
    await screen.findByText("Stage 2");
    expect(playedSources()).toEqual([]);
  });

  it("triggers no reward when the game has none", async () => {
    renderVariant(withAudio);
    await enterStage(1);
    answer("custard");
    await screen.findByText("Stage 2");
    expect(rewardSpy).not.toHaveBeenCalled();
  });

  it("triggers the configured reward once when a stage is completed", async () => {
    renderVariant({ ...withAudio, reward: { animation: "confetti", particleCount: 50 } });
    await enterStage(1);
    answer("custard");
    await vi.waitFor(() => expect(rewardSpy).toHaveBeenCalledTimes(1));
    expect(useRewardSpy).toHaveBeenCalledWith("reward-element", "confetti", { particleCount: 50 });
  });

  it("doesn't replay the reward or sound for stages completed before the game was continued", async () => {
    const game = { ...withAudio, sounds, reward: { animation: "confetti", particleCount: 50 } } satisfies GameData;
    saveGameState(SMALL_GAME_ID, completeChallenge(createBlankGameState(game), "stage-1", "stage-1-challenge"));
    renderVariant(game);

    await screen.findByText("Stage 2");
    await vi.waitFor(() => expect(playedSources()).toContain("https://sounds.example/opening.mp3"));
    expect(rewardSpy).not.toHaveBeenCalled();
    expect(playedSources()).not.toContain("https://sounds.example/completed.mp3");
  });

  it("keeps the screen awake until every stage is complete", async () => {
    const sentinel = new FakeWakeLockSentinel();
    const { request, restore } = stubWakeLock(async () => sentinel);
    wakeLockRestores.push(restore);
    renderGame();
    await screen.findByText("Small Game");
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    await enterStage(1);
    answer("custard");
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    await enterStage(2);
    answer("trifle");

    await waitFor(() => expect(sentinel.released).toBe(true));
  });
});
