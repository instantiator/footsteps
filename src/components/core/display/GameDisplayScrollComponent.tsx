import ArrowCircleLeftTwoToneIcon from "@mui/icons-material/ArrowCircleLeftTwoTone";
import ArrowCircleRightTwoToneIcon from "@mui/icons-material/ArrowCircleRightTwoTone";
import { useState, type CSSProperties } from "react";
import metadata from "../../../assets/resources/assets-metadata.json";
import oldPaperImage from "../../../assets/resources/old-paper.png";
import type {
  GameDisplayScrollComponentData,
  GameDisplayScrollComponentDataContent,
} from "../../../entities/data/displays/GameDisplayScrollComponentData";
import type { GameDisplayTemplateSourceData } from "../../../entities/data/displays/GameDisplayTemplateComponentData";
import type { GameChallengeId } from "../../../entities/data/GameChallengeData";
import type { GameChallengeSolution } from "../../../entities/data/GameChallengeSolution";
import type { GameStageId } from "../../../entities/data/GameStageData";
import type { GameAnswerFunction } from "../Game";
import type { GameTemplateData } from "../logic/RenderDataUtils";
import { parseLines } from "../logic/TemplateUtils";
import GameAudioComponent from "./GameAudioComponent";
import type { LayerHint } from "./GameDisplayComponent";
import GameDisplayTemplateComponent from "./GameDisplayTemplateComponent";
import GameTextInputComponent, { type GameTextInputComponentProps } from "./GameTextInputComponent";

interface GameDisplayScrollComponentProps {
  templateSource?: GameDisplayTemplateSourceData;
  containerStyle?: React.CSSProperties;
  templateStyle?: CSSProperties;
  templateData?: GameTemplateData;
  scrollData: GameDisplayScrollComponentData;
  layerHint: LayerHint;
  stageId?: GameStageId;
  challengeId?: GameChallengeId;
  solution?: GameChallengeSolution;
  onAnswer?: GameAnswerFunction;
}

const paperMetadataEntry = metadata.resources.find((entry) => entry.file === "old-paper.png");
const PAPER_ASPECT_RATIO = `${paperMetadataEntry?.width}/${paperMetadataEntry?.height}`;

/** Fades the scrolling text out at the top and bottom of the paper. */
const SCROLL_FADE_MASK = "linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)";

/** The default template: the text, line by line, in the foreground; nothing (the paper) behind it. */
const defaultTemplate = (layerHint: LayerHint): GameDisplayTemplateSourceData => ({
  sourceType: "embedded",
  content: layerHint === "foreground" ? "{{#lines}}<p>{{.}}</p>{{/lines}}" : "<!-- scroll -->",
});

/** Foreground: a scrolling text column sized to the paper. Background: the paper image itself. */
const scrollContainerStyle = (layerHint: LayerHint, containerStyle?: CSSProperties): CSSProperties =>
  layerHint === "foreground"
    ? {
        aspectRatio: PAPER_ASPECT_RATIO,
        display: "flex",
        flexDirection: "column",
        justifyContent: "start",
        alignItems: "center",
        width: "auto",
        height: "80%",
        overflowY: "auto",
        marginTop: "18vh",
        marginBottom: "5vh",
        paddingBottom: "5vh",
        maskImage: SCROLL_FADE_MASK,
        WebkitMaskImage: SCROLL_FADE_MASK,
        ...containerStyle,
      }
    : {
        width: "100%",
        height: "100%",
        backgroundImage: `url(${oldPaperImage})`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        filter: "drop-shadow(8px 8px 10px rgba(0, 0, 0, 0.5))",
        ...containerStyle,
      };

const OUTER_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "start",
  alignItems: "center",
};

const NAVIGATION_STYLE: CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "5%",
  marginBottom: "5vh",
  paddingLeft: "2%",
  paddingRight: "2%",
};

/** Arrows to page back and forward through the scroll's contents, with spacers where there's no page. */
function ScrollNavigation({ onRetreat, onAdvance }: { onRetreat?: () => void; onAdvance?: () => void }) {
  if (!onRetreat && !onAdvance) return null;
  return (
    <div style={NAVIGATION_STYLE}>
      {onRetreat ? (
        <span onClick={onRetreat} style={{ cursor: "pointer" }}>
          <ArrowCircleLeftTwoToneIcon style={{ fontSize: "3em" }} />
        </span>
      ) : (
        <div style={{ width: "3em" }}></div>
      )}
      {onAdvance ? (
        <span onClick={onAdvance} style={{ cursor: "pointer" }}>
          <ArrowCircleRightTwoToneIcon style={{ fontSize: "3em" }} />
        </span>
      ) : (
        <div style={{ width: "3em" }}></div>
      )}
    </div>
  );
}

interface ScrollPageControlsProps {
  content: GameDisplayScrollComponentDataContent | undefined;
  input: Pick<GameTextInputComponentProps, "stageId" | "challengeId" | "solved" | "setSolved" | "onAnswer">;
  onRetreat?: () => void;
  onAdvance?: () => void;
}

/** The current page's audio and answer input (if it has them), and the page navigation. */
function ScrollPageControls({ content, input, onRetreat, onAdvance }: ScrollPageControlsProps) {
  return (
    <>
      {content?.media?.type === "audio" && (
        <GameAudioComponent audioStyle={{ margin: "10px", opacity: 0.25 }} media={content.media} controls={true} />
      )}
      {content?.showInput && <GameTextInputComponent {...input} autoSubmit={true} label={content.label} />}
      <ScrollNavigation onRetreat={onRetreat} onAdvance={onAdvance} />
    </>
  );
}

/** A paged scroll of text, optionally with audio and an answer input on each page. */
export default function GameDisplayScrollComponent({
  templateSource,
  containerStyle,
  templateStyle,
  templateData,
  scrollData,
  layerHint,
  stageId,
  challengeId,
  solution,
  onAnswer,
}: GameDisplayScrollComponentProps) {
  const [solved, setSolved] = useState<boolean>(false);
  const [contentIndex, setContentIndex] = useState<number>(0);
  const content: GameDisplayScrollComponentDataContent | undefined = scrollData.contents[contentIndex];

  return (
    <div style={OUTER_STYLE}>
      <GameDisplayTemplateComponent
        templateSource={templateSource ?? defaultTemplate(layerHint)}
        containerStyle={scrollContainerStyle(layerHint, containerStyle)}
        templateStyle={{ ...templateStyle }}
        templateData={{ text: content?.text, lines: parseLines(content?.text), ...templateData }}
        solution={solution}
        onAnswer={onAnswer}
      >
        {layerHint === "foreground" && (
          <ScrollPageControls
            content={content}
            input={{ stageId, challengeId, solved, setSolved, onAnswer }}
            onRetreat={contentIndex > 0 ? () => setContentIndex(contentIndex - 1) : undefined}
            onAdvance={
              contentIndex < scrollData.contents.length - 1 ? () => setContentIndex(contentIndex + 1) : undefined
            }
          />
        )}
      </GameDisplayTemplateComponent>
    </div>
  );
}
