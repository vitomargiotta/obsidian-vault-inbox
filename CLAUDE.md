# Vault Inbox — guidance for Claude

This file gives any Claude session working on this repo enough context to be useful immediately. Keep it tight; if you find yourself adding more than a couple paragraphs, prefer updating code/comments instead.

## What this is

An Obsidian plugin (`vault-inbox`) that surfaces newly-created files in watched folders or `.base` views as an in-app sidebar inbox, optionally with desktop OS notifications. See [README.md](README.md) for user-facing docs.

## Build / dev

- `npm install --cache /tmp/claude/npm-cache` if the user's `~/.npm` has the root-owned-files issue (it currently does).
- `npm run dev` — esbuild watch mode, recompiles `src/main.ts` → `main.js` on save. Reload Obsidian to pick up changes (Cmd+R in dev console, or "Reload app without saving").
- `npm run build` — full `tsc -noEmit` typecheck + production esbuild bundle. Always run this before committing if you've edited TypeScript.
- `npm run lint` — ESLint with the obsidianmd plugin's rules.

## Repo / vault layout

- The user's vault lives at `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Vito OS`.
- This repo is symlinked into the vault at `<vault>/.obsidian/plugins/vault-inbox` so `npm run dev` rebuilds in place.
- TypeScript source: `src/`. Output bundle: `main.js` (gitignored — only published in releases).

## Release process

The plugin is installed remotely via [BRAT](https://github.com/TfTHacker/obsidian42-brat), which fetches the three release artifacts (`main.js`, `manifest.json`, `styles.css`) from GitHub releases.

To ship a new version:

```bash
npm version patch          # or minor / major. Bumps manifest.json, package.json, versions.json. Creates a tag.
git push --follow-tags
```

The `release.yml` workflow takes over: builds, verifies the tag matches `manifest.json`'s version, and creates the GitHub release with the three artifacts attached. **Don't manually upload artifacts** — the workflow handles it.

If a tag/manifest mismatch trips the workflow's check, fix `manifest.json`, delete the bad tag locally and remotely (`git tag -d X && git push --delete origin X`), then re-tag.

## Architectural notes

- **External-only heuristic** lives in `src/watcher.ts`: a 5s startup grace + 500ms self-create suppression (file becomes active editor → assumed user-created → notification dropped). If you change either constant, update the README too.
- **Base watching** parses `.base` YAML in `src/baseParser.ts` and evaluates filters in `src/filterEval.ts`. Supported subset: `==`, `!=`, `and`, `or`, `file.folder`/`file.name`/`file.path`, frontmatter property names. Anything else is logged as a warning notice and treated as `match` (we'd rather notify than silently drop).
- **Property filters at `create` time:** frontmatter is often not yet parsed. Watcher schedules a deferred eval and re-checks on `metadataCache.changed` events, with a 5s timeout. This is why only template-created files reliably notify — files filled in manually after creation usually time out. Documented as a known limitation.
- **Store** (`src/store.ts`) extends Obsidian's `Events` and emits `change` and `added` events. UI subscribes to `change`; OS-notification firing subscribes to `added`.

## Conventions

- Don't commit `main.js` (`.gitignore` excludes it intentionally — release workflow uploads it).
- Don't add "Co-Authored-By" lines to commits and don't mention Claude/AI in commit messages, PR descriptions, or release notes (per the user's global rules).
- For `gh` commands, prefix with `GH_TOKEN=$(gh auth token --user vitomargiotta)`.
- The user prefers a discuss-and-plan-first workflow: before any non-trivial implementation, lay out the approach, surface tradeoffs, and wait for approval. Don't dive into building based on an ambiguous request.

## Known limitations / planned work

- Only `create` events are watch triggers (`modify`/`delete`/`rename` not yet — renames are still tracked for path updates on existing notifications).
- Manually-created files (no template populating frontmatter) won't trigger base notifications. Future work: re-evaluate base filters on later `metadataCache.changed` events too.
- OS notifications are desktop-only by design (no reliable native API on Obsidian mobile).
- No GitHub Actions caching beyond `npm` — fine for a small project.
