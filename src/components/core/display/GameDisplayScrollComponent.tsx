import type { CSSProperties } from "react";
import oldPaperImage from "../../../assets/resources/old-paper.png";
import type { GameDisplayDialogMargins } from "../../../entities/data/displays/GameDisplayDialogComponentData";
import GameDisplayDialogComponent, { type GameDisplayDialogComponentProps } from "./GameDisplayDialogComponent";

/** Where the text sits on the old paper, clear of its torn edges and curled top. */
const SCROLL_MARGINS: GameDisplayDialogMargins = { top: "20%", right: "12%", bottom: "10%", left: "12%" };

/** Fades the scrolling text out at its top and bottom. */
const SCROLL_FADE_MASK = "linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)";

/** The paper's shadow, behind the game's other content. */
const PAPER_STYLE: CSSProperties = { filter: "drop-shadow(8px 8px 10px rgba(0, 0, 0, 0.5))" };

/** The text fades as it scrolls under the top and bottom margins. */
const TEXT_STYLE: CSSProperties = { maskImage: SCROLL_FADE_MASK, WebkitMaskImage: SCROLL_FADE_MASK };

/** A dialog on the app's old-paper image: paged text, optionally with audio and an answer input on each page. */
export default function GameDisplayScrollComponent(props: Omit<GameDisplayDialogComponentProps, "image" | "margins">) {
  return (
    <GameDisplayDialogComponent
      {...props}
      image={oldPaperImage}
      margins={SCROLL_MARGINS}
      containerStyle={
        props.layerHint === "background" ? { ...PAPER_STYLE, ...props.containerStyle } : props.containerStyle
      }
      templateStyle={props.layerHint === "foreground" ? { ...TEXT_STYLE, ...props.templateStyle } : props.templateStyle}
    />
  );
}
