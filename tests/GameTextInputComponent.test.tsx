import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GameTextInputComponent from "../src/components/core/display/GameTextInputComponent";
import type { GameAnswerFunction } from "../src/components/core/Game";

const renderInput = (onAnswer: GameAnswerFunction, setSolved = vi.fn()) => {
  render(<GameTextInputComponent stageId="s1" challengeId="c1" onAnswer={onAnswer} setSolved={setSolved} />);
  return { input: screen.getByRole("textbox"), setSolved };
};

describe("GameTextInputComponent", () => {
  it("submits each change as an answer, and shows why a wrong one is wrong", () => {
    const onAnswer = vi.fn<GameAnswerFunction>(() => ["Not quite"]);
    const { input, setSolved } = renderInput(onAnswer);
    expect(onAnswer).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "trifle" } });
    expect(onAnswer).toHaveBeenCalledWith("s1", "c1", "trifle");
    expect(setSolved).toHaveBeenLastCalledWith(false);
    expect(screen.getByText("Not quite")).toBeInTheDocument();
  });

  it("marks the challenge solved when the answer is right", () => {
    const { input, setSolved } = renderInput(() => true);
    fireEvent.change(input, { target: { value: "custard" } });
    expect(setSolved).toHaveBeenLastCalledWith(true);
  });

  it("does not submit on change when autoSubmit is off", () => {
    const onAnswer = vi.fn<GameAnswerFunction>(() => true);
    render(<GameTextInputComponent stageId="s1" challengeId="c1" onAnswer={onAnswer} autoSubmit={false} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "trifle" } });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  // BUG #6 (docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md): with autoSubmit off, Enter should submit the typed answer; actual: nothing ever submits it
  it.skip("submits the typed answer on Enter when autoSubmit is off", () => {
    const onAnswer = vi.fn<GameAnswerFunction>(() => true);
    render(<GameTextInputComponent stageId="s1" challengeId="c1" onAnswer={onAnswer} autoSubmit={false} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "trifle" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAnswer).toHaveBeenCalledWith("s1", "c1", "trifle");
  });

  it("ignores further answers once solved, and disables the input", () => {
    const onAnswer = vi.fn<GameAnswerFunction>(() => true);
    render(<GameTextInputComponent stageId="s1" challengeId="c1" onAnswer={onAnswer} solved={true} />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
    fireEvent.change(input, { target: { value: "x" } });
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
