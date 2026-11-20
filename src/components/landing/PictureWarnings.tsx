/** What's still needed, shown over the bottom of a camera picture; nothing when nothing is. */
export default function PictureWarnings({ warnings }: { warnings: readonly string[] | undefined }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <ul className="game-picture-warnings">
      {warnings.map((warning) => (
        <li key={warning}>
          <span aria-hidden="true">⚠️ </span>
          {warning}
        </li>
      ))}
    </ul>
  );
}
