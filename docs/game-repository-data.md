# Game repository data

A game repository is a JSON file holding one or more games. Its type is `GameRepository` (`src/entities/GameRepository.ts`) and its schema is `public/schemas/game-repository-schema.json`. Check a repository with `./validate-repository.sh path/to/repository.json`, which validates its schema and that every game's resource files, templates and resource names can load.

```json
{
  "$schema": "./schemas/game-repository-schema.json",
  "games": {
    "magic-trifle": { "title": "Nanny's Magic Trifle", "displays": [], "stages": [], "gameContainerStyle": {} }
  }
}
```

| Field                       | Authored? | Meaning                                                                                                                                                                   |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `games`                     | yes       | `GameId` → `GameData`. The key is the game's id in its URL: `/game/<id>`. Each game is described in [Game data](game-data.md).                                            |
| `ready`, `loading`, `error` | no        | Set at runtime by `GameRepositoryProvider` while the file loads. A repository being loaded is `LOADING_REPOSITORY`, and a failed one is `FAILED_REPOSITORY` plus `error`. |

`public/game-repository.json` is the site's own repository. Every game in it is prerendered at `/game/<id>`. `public/test-repository.json` holds test-only games.

## Sources

`GameRepositoryProvider` (`src/providers/GameRepositoryProvider.tsx`) loads a repository from a `GameSource` (`src/entities/GameSource.ts`):

| `type`             | Field        | Loaded from                                                    |
| ------------------ | ------------ | -------------------------------------------------------------- |
| `LocalRepository`  | `path`       | `path` under this site's base URL, e.g. `game-repository.json` |
| `RemoteRepository` | `src: URL`   | That URL                                                       |
| `RawRepository`    | `repository` | Nothing: the `GameRepository` object is used as given          |

The app's pages all use the local repository. Remote and raw sources exist for loading games from elsewhere and for tests.

## Relative paths

Games refer to templates and resources by path ([Resources](game-data.md#resources), [Templating](game-data.md#templating)). A `relative` path is resolved against where the repository lives, by `resolveRelativeURL` in `src/util/ObjectUtils.ts`:

| Source             | `relative` resolves against                   | `local` paths                 |
| ------------------ | --------------------------------------------- | ----------------------------- |
| `LocalRepository`  | The site's base URL                           | Allowed                       |
| `RemoteRepository` | The directory containing the repository's URL | Resources only, not templates |
| `RawRepository`    | Not supported: loading the game fails         | Resources only, not templates |

So a remote repository can ship its templates and media alongside it, and use `relative` paths for them.
