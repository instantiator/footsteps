import ArrowCircleLeftTwoToneIcon from "@mui/icons-material/ArrowCircleLeftTwoTone";
import ArrowCircleRightTwoToneIcon from "@mui/icons-material/ArrowCircleRightTwoTone";
import { useState, type CSSProperties } from "react";
import type {
  GameDisplayDialogMargins,
  GameDisplayPageData,
} from "../../../entities/data/displays/GameDisplayDialogComponentData";
import type { GameDisplayTemplateSourceData } from "../../../entities/data/displays/GameDisplayTemplateComponentData";
import type { GameChallengeId } from "../../../entities/data/GameChallengeData";
import type { GameStageId } from "../../../entities/data/GameStageData";
import { isDefined } from "../../../util/ObjectUtils";
import type { GameAnswerFunction } from "../Game";
import type { GameTemplateData } from "../logic/RenderDataUtils";
import { parseLines } from "../logic/TemplateUtils";
import GameAudioComponent from "./GameAudioComponent";
import type { LayerHint } from "./GameDisplayComponent";
import GameDisplayTemplateComponent from "./GameDisplayTemplateComponent";
import GameTextInputComponent, { type GameTextInputComponentProps } from "./GameTextInputComponent";
import useImageAspectRatio from "./ImageAspectRatioHook";

/** Props for {@link GameDisplayDialogComponent}. */
export interface GameDisplayDialogComponentProps {
  /** URL of the background image. Without one, the dialog fills its display. */
  image?: string;
  /** Where the text sits on the image. */
  margins?: GameDisplayDialogMargins;
  /** Overrides the default template, which shows the page's text one paragraph per line. */
  templateSource?: GameDisplayTemplateSourceData;
  /** Style for the layer's container: the image (background) or the text column (foreground). */
  containerStyle?: CSSProperties;
  /** Style for the rendered template. */
  templateStyle?: CSSProperties;
  /** Extra template data, which takes precedence over the page's `text` and `lines`. */
  templateData?: GameTemplateData;
  /** The pages of text, with their optional audio and answer input. */
  contents: GameDisplayPageData[];
  /** Whether to render the image (background) or the text and controls (foreground). */
  layerHint: LayerHint;
  /** Stage of the challenge that answers are submitted to. */
  stageId?: GameStageId;
  /** Challenge that answers are submitted to. */
  challengeId?: GameChallengeId;
  /** Called when the player submits an answer on a page. */
  onAnswer?: GameAnswerFunction;
}

/** The default template: the text, line by line, in the foreground; nothing (the image) behind it. */
const defaultTemplate = (layerHint: LayerHint): GameDisplayTemplateSourceData => ({
  sourceType: "embedded",
  content: layerHint === "foreground" ? "{{#lines}}<p>{{.}}</p>{{/lines}}" : "<!-- dialog -->",
});

/** Fills the display, and centres the frame in it. The display's size is the container for `cq*` units. */
const OUTER_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  containerType: "size",
  display: "grid",
  placeItems: "center",
};

/**
 * The image's box: the largest of its aspect ratio that fits the display, whether that means scaling the
 * image up or down. Until the ratio is known (or with no image), it fills the display.
 */
const frameStyle = (ratio: number | undefined): CSSProperties =>
  isDefined(ratio)
    ? { position: "relative", aspectRatio: ratio, width: `min(100cqw, calc(100cqh * ${ratio}))` }
    : { position: "relative", width: "100%", height: "100%" };

/** The text column, inset from the frame's edges by the margins. Its text scrolls; see {@link SCROLLING_TEXT_STYLE}. */
const textColumnStyle = ({
  top = "0",
  right = "0",
  bottom = "0",
  left = "0",
}: GameDisplayDialogMargins = {}): CSSProperties => ({
  position: "absolute",
  top,
  right,
  bottom,
  left,
  width: "auto",
  height: "auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  overflow: "hidden",
});

/** The page text takes the column's spare height and scrolls within it, so the page controls stay in view below it. */
const SCROLLING_TEXT_STYLE: CSSProperties = { flex: "1 1 auto", minHeight: 0, width: "100%", overflowY: "auto" };

/** Foreground: the text column. Background: the image itself, stretched over the frame it sized. */
const layerStyle = (
  layerHint: LayerHint,
  image: string | undefined,
  margins: GameDisplayDialogMargins | undefined,
  containerStyle: CSSProperties | undefined,
): CSSProperties => ({
  ...(layerHint === "foreground" && textColumnStyle(margins)),
  ...(layerHint === "background" &&
    isDefined(image) && { backgroundImage: `url(${image})`, backgroundSize: "100% 100%" }),
  ...containerStyle,
});

/** Spreads the previous and next arrows to either side. */
const NAVIGATION_STYLE: CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "5%",
  marginBottom: "5%",
  paddingLeft: "2%",
  paddingRight: "2%",
};

/** Arrows to page back and forward through a dialog's contents, with spacers where there's no page. */
export function PageNavigation({ onRetreat, onAdvance }: { onRetreat?: () => void; onAdvance?: () => void }) {
  if (!onRetreat && !onAdvance) return null;
  return (
    <div style={NAVIGATION_STYLE}>
      {onRetreat ? (
        <button type="button" className="plain-button" onClick={onRetreat} aria-label="Previous page">
          <ArrowCircleLeftTwoToneIcon style={{ fontSize: "3em" }} />
        </button>
      ) : (
        <div style={{ width: "3em" }}></div>
      )}
      {onAdvance ? (
        <button type="button" className="plain-button" onClick={onAdvance} aria-label="Next page">
          <ArrowCircleRightTwoToneIcon style={{ fontSize: "3em" }} />
        </button>
      ) : (
        <div style={{ width: "3em" }}></div>
      )}
    </div>
  );
}

/** Props for {@link PageControls}. */
interface PageControlsProps {
  /** The current page, if there is one. */
  content: GameDisplayPageData | undefined;
  /** What the page's answer input needs to submit answers. */
  input: Pick<GameTextInputComponentProps, "stageId" | "challengeId" | "solved" | "setSolved" | "onAnswer">;
  /** Goes back a page; undefined on the first page. */
  onRetreat?: () => void;
  /** Goes on a page; undefined on the last page. */
  onAdvance?: () => void;
}

/** The current page's audio and answer input (if it has them), and the page navigation. */
function PageControls({ content, input, onRetreat, onAdvance }: PageControlsProps) {
  return (
    <>
      {content?.media?.type === "audio" && (
        <GameAudioComponent audioStyle={{ margin: "10px", opacity: 0.25 }} media={content.media} controls={true} />
      )}
      {content?.showInput && <GameTextInputComponent {...input} autoSubmit={true} label={content.label} />}
      <PageNavigation onRetreat={onRetreat} onAdvance={onAdvance} />
    </>
  );
}

/**
 * Pages of text on a background image, optionally with audio and an answer input on each page. The image
 * scales to fit the display, and the text stays within its margins. The background and foreground layers
 * size themselves from the image independently, so they line up without knowing each other.
 */
export default function GameDisplayDialogComponent({
  image,
  margins,
  templateSource,
  containerStyle,
  templateStyle,
  templateData,
  contents,
  layerHint,
  stageId,
  challengeId,
  onAnswer,
}: GameDisplayDialogComponentProps) {
  const [solved, setSolved] = useState<boolean>(false);
  const [contentIndex, setContentIndex] = useState<number>(0);
  const ratio = useImageAspectRatio(image);
  const content: GameDisplayPageData | undefined = contents[contentIndex];

  return (
    <div style={OUTER_STYLE}>
      <div style={frameStyle(ratio)}>
        <GameDisplayTemplateComponent
          templateSource={templateSource ?? defaultTemplate(layerHint)}
          containerStyle={layerStyle(layerHint, image, margins, containerStyle)}
          templateStyle={{ ...(layerHint === "foreground" && SCROLLING_TEXT_STYLE), ...templateStyle }}
          templateData={{ text: content?.text, lines: parseLines(content?.text), ...templateData }}
        >
          {layerHint === "foreground" && (
            <PageControls
              content={content}
              input={{ stageId, challengeId, solved, setSolved, onAnswer }}
              onRetreat={contentIndex > 0 ? () => setContentIndex(contentIndex - 1) : undefined}
              onAdvance={contentIndex < contents.length - 1 ? () => setContentIndex(contentIndex + 1) : undefined}
            />
          )}
        </GameDisplayTemplateComponent>
      </div>
    </div>
  );
}
