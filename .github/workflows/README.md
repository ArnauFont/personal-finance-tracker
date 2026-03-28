# GitHub Workflows

## Semantic tag creation on merged PRs

The [`semantic-release-tag.yml`](./semantic-release-tag.yml) workflow creates a git tag every time a pull request is **merged into `master`**.

It reads the commits included in that PR and determines the bump using conventional commits:

- **major**: any commit has a breaking change (`type(scope)!:` or `BREAKING CHANGE:` in the message)
- **minor**: at least one commit is `feat:` (and no breaking changes exist)
- **patch**: otherwise

Then it finds the latest semver tag (`vX.Y.Z` or `X.Y.Z`) and creates the next version tag on the PR merge commit SHA.

### Examples

Assume the latest tag is `v1.4.2`.

1. PR commits:
   - `fix: correct currency rounding`
   - `docs: update setup notes`
   - `chore: tidy lint config`

   Resulting tag: **`v1.4.3`** (patch)

2. PR commits:
   - `feat: add account import from CSV`
   - `fix: handle empty rows in parser`

   Resulting tag: **`v1.5.0`** (minor)

3. PR commits:
   - `feat(api)!: replace balances endpoint payload`
   - `fix: adjust client mapper`

   Resulting tag: **`v2.0.0`** (major)

4. PR commits:
   - `refactor: split sync service`
   - `chore: update tests`
   - `docs: migration guide`
   - Commit message footer includes `BREAKING CHANGE: sync payload now requires accountId`

   Resulting tag: **`v2.0.0`** (major)
