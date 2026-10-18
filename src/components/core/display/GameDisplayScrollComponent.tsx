// import { useReward } from "partycles";
import ArrowCircleLeftTwoToneIcon from "@mui/icons-material/ArrowCircleLeftTwoTone";
import ArrowCircleRightTwoToneIcon from "@mui/icons-material/ArrowCircleRightTwoTone";
import { useEffect, useState, type CSSProperties } from "react";
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
import { parseLines } from "../logic/TemplateUtils";
import GameAudioComponent from "./GameAudioComponent";
import type { LayerHint } from "./GameDisplayComponent";
import GameDisplayTemplateComponent from "./GameDisplayTemplateComponent";
import GameTextInputComponent from "./GameTextInputComponent";

interface GameDisplayScrollComponentProps {
  templateSource?: GameDisplayTemplateSourceData;
  containerStyle?: React.CSSProperties;
  templateStyle?: CSSProperties;
  templateData?: Record<string, any>;
  scrollData: GameDisplayScrollComponentData;
  layerHint: LayerHint;
  stageId?: GameStageId;
  challengeId?: GameChallengeId;
  solution?: GameChallengeSolution;
  onAnswer?: GameAnswerFunction;
}

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
  const paperMetadataEntry = metadata.resources.find((entry) => entry.file === "old-paper.png");
  const paperAspectRatio = `${paperMetadataEntry?.width}/${paperMetadataEntry?.height}`;

  const [solved, setSolved] = useState<boolean>(false);

  const [template, setTemplate] = useState<GameDisplayTemplateSourceData | undefined>(undefined);
  const [templateContainerStyle, setTemplateContainerStyle] = useState<React.CSSProperties>({});

  const [contentIndex, setContentIndex] = useState<number>(0);
  const [content, setContent] = useState<GameDisplayScrollComponentDataContent | undefined>(undefined);

  useEffect(() => {
    setContent(scrollData.contents[contentIndex]);
  }, [scrollData.contents, contentIndex]);

  const onAdvanceClick = () => {
    if (contentIndex < scrollData.contents.length - 1) {
      setContentIndex(contentIndex + 1);
    }
  };
  const onRetreatClick = () => {
    if (contentIndex > 0) {
      setContentIndex(contentIndex - 1);
    }
  };

  useEffect(() => {
    setTemplate(
      templateSource ??
        (layerHint === "foreground"
          ? ({
              sourceType: "embedded",
              content: "{{#lines}}<p>{{.}}</p>{{/lines}}",
            } as GameDisplayTemplateSourceData)
          : ({
              sourceType: "embedded",
              content: "<!-- scroll -->",
            } as GameDisplayTemplateSourceData)),
    );

    setTemplateContainerStyle(
      layerHint === "foreground"
        ? {
            aspectRatio: paperAspectRatio,
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
            maskImage: "linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)",
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
          },
    );
  }, [templateSource, layerHint, paperAspectRatio, containerStyle]);

  const showAdvance = contentIndex < scrollData.contents.length - 1;
  const showRetreat = contentIndex > 0;
  const showButtons = showAdvance || showRetreat;

  return (
    <>
      {template && (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "start",
            alignItems: "center",
          }}
        >
          <GameDisplayTemplateComponent
            templateSource={template}
            containerStyle={{ ...templateContainerStyle }}
            templateStyle={{ ...templateStyle }}
            templateData={{ text: content?.text, lines: parseLines(content?.text), ...templateData }}
            solution={solution}
            onAnswer={onAnswer}
          >
            {layerHint === "foreground" && (
              <>
                {content?.media?.type === "audio" && (
                  <GameAudioComponent
                    audioStyle={{ margin: "10px", opacity: 0.25 }}
                    media={content?.media}
                    controls={true}
                  />
                )}

                {content?.showInput && (
                  <GameTextInputComponent
                    stageId={stageId}
                    challengeId={challengeId}
                    solved={solved}
                    setSolved={setSolved}
                    autoSubmit={true}
                    onAnswer={onAnswer}
                    label={content.label}
                  />
                )}

                {showButtons && (
                  <div
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "5%",
                      marginBottom: "5vh",
                      paddingLeft: "2%",
                      paddingRight: "2%",
                    }}
                  >
                    {showRetreat && (
                      <span onClick={onRetreatClick} style={{ cursor: "pointer" }}>
                        <ArrowCircleLeftTwoToneIcon style={{ fontSize: "3em" }} />
                      </span>
                    )}
                    {!showRetreat && <div style={{ width: "3em" }}></div>}
                    {showAdvance && (
                      <span onClick={onAdvanceClick} style={{ cursor: "pointer" }}>
                        <ArrowCircleRightTwoToneIcon style={{ fontSize: "3em" }} />
                      </span>
                    )}
                    {!showAdvance && <div style={{ width: "3em" }}></div>}
                  </div>
                )}
              </>
            )}
          </GameDisplayTemplateComponent>
        </div>
      )}
    </>
  );
}
