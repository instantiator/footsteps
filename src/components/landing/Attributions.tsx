import { Fragment, useContext } from "react";
import { GameRepositoryContext } from "../../providers/GameRepositoryContext";

/** Credits for the media the app itself uses, then each game's own credits; each game credits its media in its data. */
export default function Attributions() {
  const { repository } = useContext(GameRepositoryContext);
  const gamesWithCredits = Object.entries(repository.games).filter(([, game]) => (game.credits?.length ?? 0) > 0);

  return (
    <>
      <h3>Footsteps</h3>
      <ul>
        <li>
          <a href="https://www.flaticon.com/free-icons/shoe" title="shoe icons">
            Shoe icons created by jessicurr11 - Flaticon
          </a>
        </li>
        <li>
          <a
            href="https://gallery.yopriceville.com/Free-Clipart-Pictures/Scrolls-PNG/Old_Large_Paper_PNG_Clipart"
            title="parchment image"
          >
            Old Large Paper PNG Clipart
          </a>{" "}
          by <a href="https://gallery.yopriceville.com/">YoPriceVille Gallery</a>
        </li>
      </ul>
      {gamesWithCredits.map(([gameId, game]) => (
        <Fragment key={`credits-${gameId}`}>
          <h3>{game.title}</h3>
          <ul>
            {(game.credits ?? []).map(({ text, url }) => (
              <li key={text}>{url ? <a href={url}>{text}</a> : text}</li>
            ))}
          </ul>
        </Fragment>
      ))}
    </>
  );
}
