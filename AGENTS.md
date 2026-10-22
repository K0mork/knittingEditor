# Repository Guidelines

## Project Structure & Module Organization

This repository is a Vite/React knitting-chart editor deployed as a static GitHub Pages site and the shared source repository for the iOS/iPadOS app under `ios/`. Code shared by both builds lives in `packages/editor-core` (`model/`, `stitches/`, `storage/`, `export/`, `canvas/`, `state/`, `ui/`, `util/`, `analytics.ts`, `platform.ts`) together with its tests, including the editor screen itself (`ui/useEditorController.ts` and `ui/EditorView.tsx`). The root `src/` and `ios/Web/src/` entrypoints import it directly and keep only the host-specific differences listed in `docs/WEB_SYNC.md`. Browser tests live in `tests/e2e/`; static SEO and domain files are in `public/`.

## Build, Test, and Development Commands

Use Node.js 24 and the single lockfile at the repository root. Install pinned dependencies and start the development server:

```sh
npm ci
npm run dev
```

Before committing, run the full local checks:

```sh
npm run typecheck
npm test
npm run build
npm run check:dist
npm run test:e2e
```

## Hosting & Production Constraints

This application is hosted by GitHub Pages and is publicly deployed at `https://knittingeditor.com/`. The `main` branch is the production source. A push to `main` triggers `.github/workflows/ci.yml`; Web or shared-code changes must pass the relevant PR-tier jobs (`changes`, full Playwright `web`, `ios_web`, `app_store_docs`, and one iPhone `ios` job with all unit tests and selected UI smoke tests) through `ci-gate` before the generated `dist/` artifact is deployed. The full iOS suite is separate in `.github/workflows/ios-full.yml`: iPhone/iPad full tests, both app-update tests, and unsigned Release Archive run after relevant merges, nightly, or with `workflow_dispatch`; they do not gate Pages. Failures on main or nightly create an issue (or comment on the existing open failure issue) labeled `bug`, `priority:P1`, and `platform:ios`. iOS-only changes do not redeploy Pages. `public/CNAME` must remain `knittingeditor.com`, and Vite must continue to build for the site root (`base: '/'`).

Codex must treat the following as production requirements:

- Do not commit secrets, environment-specific credentials, or runtime server assumptions. The deployed application must remain a static site.
- Do not edit generated `dist/` files directly or commit them. Change source or `public/` assets and let the workflow build `dist/`.
- Do not change the custom domain, Pages workflow, deployment permissions, or production branch unless the user explicitly requests it.
- For routing, asset-path, service-worker, SEO, or domain changes, verify that direct access and reloads work under `https://knittingeditor.com/` and that all production URLs use HTTPS.

## Confidential Information

This repository, its history, and everything posted on GitHub (issues, pull request titles and descriptions, comments, review notes, commit messages, CI logs, and attached screenshots) are public. Codex must not publish the following in any of them:

- Figures from Google Analytics, Search Console, App Store Connect, or any other analytics or sales source: counts or rates of users, sessions, events, downloads, purchases, or conversions; revenue; search queries and rankings; and screenshots of these dashboards.
- Links to or identifiers of private dashboards and accounts, such as GA4 account or property IDs in report URLs and App Store Connect app or team IDs. Identifiers that the shipped site or app must contain, such as the GA4 measurement ID in `src/analytics.ts`, the Bundle ID, and in-app purchase product IDs, are allowed.
- Unannounced prices, revenue or fee calculations, sales forecasts, break-even estimates, and other business plans that are not yet public.
- Personal data: names other than the published copyright holder, email addresses, postal addresses, tax, bank, or contract details, and data about individual users.

Write qualitative statements instead, for example "PDF exports are recorded" or "the event arrived in GA4 Realtime". Keep figures, prices, calculations, unannounced schedules, and personal tax or legal details in the root `private/` directory, which Git ignores, or outside the repository, and refer to them only by that location. `private/` exists only in the main checkout at the repository root, where it may be a symbolic link to the maintainer's synced folder; from a worktree, read and write the main checkout's `private/` instead of creating another one. Its `README.md` lists what each file holds. Before committing, pushing, or posting to GitHub, check the diff and the text for these items.

If confidential information has already been pushed, stop and tell the user, then remove it from the current files with a new commit. Rewriting the history of a non-`main` branch or deleting pull request description revisions requires the user's approval, and `main` history must never be force-pushed.

## Development Log

Codex must record every user-visible feature, bug fix, behavior change, migration, build/test configuration change, and deployment change, in both the Web and the iOS parts of this repository, as one new file in `docs/dev-log/`. Each pull request adds its own file, so pull requests developed in parallel never conflict over the log. Name the file `YYYY-MM-DD-<slug>.md`, where the slug is the branch name without its type prefix (for `fix/preserve-grid-after-resize`, `2026-10-06-preserve-grid-after-resize.md`); the format is in `docs/dev-log/README.md`. Do not edit another pull request's file to record your change. The root `DEVELOPMENT_LOG.md` is a frozen archive of entries up to 2026-10-06, and `ios/DEVELOPMENT_LOG.md` is a frozen archive of the app history from before the repositories were merged; neither receives new entries. Documentation-only edits with no runtime, test, or deployment impact may be omitted.

Each entry file contains:

- the date (`YYYY-MM-DD`) and a short summary;
- the affected behavior and main files;
- tests added or updated and the exact verification commands run;
- deployment impact, including `none` when there is none, and any post-deployment check required.

The entry belongs in the pull request that makes the change and must be present before that pull request is merged. It records what changed and the checks run before merging. Do not open pull requests only to record results that appear after merging: workflow runs and deployments are already recorded in GitHub Actions and the `github-pages` environment, and manual post-deployment checks are reported as a comment on the merged pull request (see Deployment Procedure). Dependency-only pull requests from Dependabot need no entry; they are listed in the generated release notes (see GitHub Workflow).

Follow Confidential Information in log entries: record that analytics events were received or that a metric was checked, never the counts themselves.

Never claim a check passed unless it was actually run. If a required check cannot be run, record the reason in both the `docs/dev-log/` entry and the final response.

## Change-specific Test Requirements

Codex must add or update tests with each behavior change. Select checks based on the changed area:

- Model, migration, storage, or export rules: add or update Vitest coverage with `npm test`.
- User workflows, persistence, gestures, responsive behavior, PNG/PDF output, or browser-facing regressions: add or update Playwright coverage and run `npm run test:e2e` in both configured Chromium and WebKit projects.
- UI or visual changes: manually inspect narrow/mobile and desktop viewports and save screenshots for the pull request; do not commit generated screenshots unless requested.
- Build, public assets, metadata, routes, CNAME, or deployment changes: run `npm run build` and `npm run check:dist`, then inspect `dist/` for the expected production paths and `CNAME`.
- Changes under `packages/`, iOS source, iOS build configuration, or iOS test code: PR CI runs iOS Web typecheck/tests and one iPhone 17 job with every `bundle.unit-test` target derived from `ios/project.yml`, selected UI smoke tests, and Debug offline bundle inspection. `ci-gate` requires these relevant PR-tier jobs and always-on document/smoke-list validation. The separate `.github/workflows/ios-full.yml` runs all unit/UI tests on iPhone 17 and iPad (A16), app-update on both, and unsigned Release Archive/offline inspection after relevant main pushes and nightly (18:23 UTC). No iPad UI exclusion list is used. Main/nightly failures open or update a labeled GitHub issue with the run URL. Before reporting iOS work complete, confirm every full-tier job succeeded for the post-merge commit or for a later `main` commit that contains it (the workflow cancels older in-progress runs on the same branch, so after consecutive merges only the newest commit is validated), in addition to its PR-tier checks. A nightly run counts only if its commit contains the change.
- For risky iOS changes (persistence/migration, native Files/share sheets, iPad layout/keyboard/rotation, Swift/Xcode/build settings, dependencies, or tests outside smoke coverage), manually run `ios-full.yml` with `workflow_dispatch` on the feature branch before merging and confirm all jobs for that branch SHA; still confirm the post-merge run. Run the full Simulator suite locally only when a failure needs repeated/instrumented investigation or CI cannot exercise the change. Locally run iOS Web typecheck/tests for `packages/` or `ios/Web/` changes; XcodeGen and an app build for Swift/project/build-setting changes; static checks for scripts/documents; and targeted tests when iteration is needed. Record local checks and checks left to PR/full CI separately in the dev-log.
- PR UI smoke selection: `ios/UITests/pr-smoke-ui-tests.txt` contains `Class/testMethod`, one per line, with separate short reason comments. Add high-value critical-flow tests that run on iPhone, keeping about 10–14 tests and roughly eight minutes of UI time; use CI timing evidence when replacing/adding selections. New UI tests automatically run in full CI on both devices but enter PR smoke only when listed. Update selections when renaming/removing methods and run `node scripts/check-pr-smoke-ui-tests.mjs` and `npm test -- scripts/check-pr-smoke-ui-tests.test.mjs`. Empty, malformed, duplicate, or nonexistent selections fail the always-on `app_store_docs` job. Environment-gated manual tests still require their manual setup; full-suite selection does not establish their execution.
- Markdown-only documentation changes: run the relevant static document check. The CI `app_store_docs` job always validates App Store documents; Web and Simulator jobs intentionally remain skipped when the whole change is documentation-only.

For Web source, shared code, dependencies, or root build configuration, the mandatory pre-commit suite is:

```sh
npm run typecheck
npm test
npm run build
npm run check:dist
npm run test:e2e
```

Targeted checks may be used during development, but they do not replace this suite when it applies. Codex must report which checks passed, failed, or were not run.

## Deployment Procedure

Codex must use the following production deployment procedure:

1. Confirm the worktree contains only intended changes, add the `docs/dev-log/` entry when required, and review the diff.
2. Run the complete pre-commit suite above and resolve every failure.
3. Commit focused changes according to the commit rules below. Do not deploy uncommitted work.
4. Before merging, confirm that the pull request contains the required `docs/dev-log/` entry. The user reviews pull requests and merges them. Codex opens the pull request, reports that it is ready for review, and leaves it unmerged; it merges a pull request only when the user explicitly asks it to merge that specific pull request, and only after its `ci-gate` check has passed (relevant PR-tier Web, iOS Web, iPhone unit/UI smoke checks, and always-on document/smoke-list checks; full-tier jobs are not gate dependencies). Approval to merge one pull request does not extend to others, including follow-up or newly opened ones. Do not push directly to `main`. Opening a pull request or pushing another branch runs validation but must not be described as a production deployment.
5. For iOS/shared changes, also confirm the separate `Full iOS validation` run for the merged commit, or for a later `main` commit that contains it, and all its iPhone/iPad tests, app-update jobs, and Release Archive before reporting iOS work complete. Its main/nightly failure issue must be investigated and resolved through a focused change; a green PR gate alone is insufficient. Confirm the `CI and deploy Pages` GitHub Actions workflow succeeded, including every job required by `ci-gate`, the `deploy` job, and the `smoke` job. `smoke` (`scripts/check-live-site.mjs`, also `npm run check:live`) waits until `https://knittingeditor.com/`, `/guide/`, and `/third-party-notices/` serve the HTML from the deployed artifact, then checks the referenced `/assets/` files, icons, OGP image, `robots.txt`, `sitemap.xml`, `CNAME`, and the HTTP-to-HTTPS redirect. A successful local build or push alone is not proof of deployment.
6. Verify `https://knittingeditor.com/` over HTTPS after deployment. Agents must prevent browser checks from sending analytics: prefer Playwright (excluded by `navigator.webdriver`); the Claude desktop built-in browser is excluded by its `Claude/` User-Agent token. Before checking with any other real browser (e.g. Claude in Chrome), run `localStorage.setItem('knitting-editor:analytics-opt-out', '1'); location.reload();` in the page console and wait for the reload before testing. `smoke` covers the fixed checks above; exercise the changed user flow yourself, and check any new asset, route, or metadata that `smoke` does not cover (or add it to the script). Report the result to the user and add it as a comment on the merged pull request; do not open a pull request only to record it.

If GitHub Actions fails or the live site does not match the deployed commit, stop, report the exact failure, and fix or revert through a new focused commit. Never bypass the test job, deploy a locally modified `dist/`, force-push production history, or claim deployment success without checking both the workflow and live site.

## GitHub Workflow

- All open work, for both Web and iOS, is tracked only in GitHub Issues. Label each issue `priority:P0` (required for the next release), `priority:P1` (quality improvement), or `priority:P2` (future candidate); add `platform:ios` for iOS work and `needs-device` when completion requires a real device, Apple signing, or TestFlight. P0 iOS issues belong to the `iOS 1.0` milestone.
- Before starting an issue, read its body for the current state and completion conditions. When newly required work is discovered, open an issue for it. A `needs-device` issue is not complete on Simulator results alone; follow `ios/docs/REAL_DEVICE_RELEASE_CHECKLIST.md`.
- Close issues from the pull request that completes them by writing `Closes #<number>` in its body, and record the verification in its `docs/dev-log/` entry. Do not close a partially completed issue; state what remains in an issue comment instead.
- Dependabot (`.github/dependabot.yml`) opens grouped npm and GitHub Actions update PRs weekly. Treat them like any other dependency change: review the changelog and require the full CI to pass before merging. Do not push commits to a Dependabot branch: Dependabot stops rebasing a pull request after someone else commits to it. Dependency-only updates need no `docs/dev-log/` entry because the `dependencies` label lists them in the generated release notes. If an update needs source, test, or configuration changes, make them in a separate pull request with its own entry.
- Label pull requests `enhancement`, `bug`, `documentation`, or `dependencies` so that generated release notes (`.github/release.yml`) are categorized.

## Branches, Worktrees & Cleanup

Several agent sessions may work in this repository at the same time. Each branch exists for one pull request and is deleted once that pull request is merged or closed. Codex must follow these rules without being asked:

- Run `git config fetch.prune true` once per clone, so that every fetch drops remote-tracking refs of branches deleted on GitHub. GitHub deletes the head branch of a merged pull request automatically.
- Keep the main checkout at the repository root on `main`, and do not switch branches, reset, or rebase in a checkout that another session uses. Start each change in its own worktree from the latest `origin/main`, with a branch named after the commit type, such as `fix/preserve-grid-after-resize`:

  ```sh
  git fetch origin
  git worktree add -b <branch> .claude/worktrees/<name> origin/main
  ```

  `.claude/worktrees/` is ignored by Git. The Claude desktop app creates its session worktrees there too. In Claude Code sessions, the project hook in `.claude/settings.json` runs `scripts/guard-shared-checkout.mjs` before every shell command and blocks, in the main checkout only, `git switch`/`checkout` to anything but `main`, `gh pr checkout`, `git stash`, `git pull` without `--ff-only`, and commands that rewrite the branch or working tree (`commit`, `merge`, `rebase`, `reset`, `restore`, `clean`, `cherry-pick`, `revert`, `am`). Codex does not run this hook and must follow the rule itself.
- The stash is shared by all worktrees. Do not use `git stash` to set work aside; make a temporary commit on your own branch instead.
- Clean up with `npm run clean:worktrees`, which runs `git fetch --prune` and lists every worktree and local branch with the decision to keep or remove it; `npm run clean:worktrees -- --apply` removes the listed ones. It removes a worktree or branch only when its tip is in `origin/main` or matches (or precedes) the head of its merged or closed pull request, and keeps anything with uncommitted changes, unpushed commits outside any pull request, an open pull request, or a process working inside it (a running session). It never switches the main checkout; it only reports when that checkout is not on `main`.
- Run the cleanup in the same session after a pull request you worked on is merged or closed, and also when starting work, to remove leftovers from earlier sessions. Then update the main checkout with `git switch main && git pull --ff-only` when nothing else uses it. If a worktree directory was deleted by other means, run `git worktree prune`.
- When cleaning up by hand, remove worktrees with `git worktree remove <path>` (not `rm`) and use `git branch -d`. Because squash merges leave the branch unmerged in Git's view, `git branch -D` is allowed only after confirming that the local branch tip equals the pull request's head commit (`gh pr view <number> --json headRefOid`) or is already in `origin/main`.
- Never remove a worktree or delete a branch that has uncommitted changes, unpushed commits that are not in any pull request, an open pull request, or a running session. Ask the user when unsure.
- Do not delete the remote branch of an open pull request. A remote branch of a merged or closed pull request that remains on GitHub may be deleted.

## Coding Style & Naming Conventions

Use two-space indentation and strict TypeScript. Use `camelCase` for functions and variables, `PascalCase` for React components and classes, and kebab-case for CSS classes. Keep the board model independent from React and DOM APIs. Do not replace the packed typed-array model with per-cell objects or render individual cells as DOM nodes. Prefer explicit types, immutable React state, and small single-purpose functions.

## Testing Guidelines

Vitest covers board and export logic; Playwright covers Chromium/WebKit at mobile and desktop sizes. Put tests for shared code in `packages/editor-core` next to the module they cover — the root `npm test` picks them up — and keep only Web-specific tests in `src/`. Tests for repository scripts sit next to them as `scripts/*.test.mjs`. Add unit tests for model rules and E2E tests for user workflows. Verify grid resizing, gestures, block copy/paste, persistence, migration, backup, PNG, and PDF behavior. For visual changes, check narrow and desktop widths and include screenshots in the pull request.

## Commit & Pull Request Guidelines

Keep each commit focused on one purpose; separate formatting-only changes. Recent history uses short imperative summaries. Prefer Conventional Commit prefixes such as `feat: add cable stitch` or `fix: preserve grid after resize`. Pull requests should explain the user-visible change, list manual checks, link related issues, and include screenshots for UI or stitch-symbol changes. Pull request text and screenshots must follow Confidential Information. Avoid committing generated PNG/PDF files or local `.DS_Store` files.
