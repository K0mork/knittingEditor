# Repository Guidelines

## Project Structure & Module Organization

This repository is a Vite/React knitting-chart editor deployed as a static GitHub Pages site and the shared source repository for the iOS/iPadOS app under `ios/`. Code shared by both builds lives in `packages/editor-core` (`model/`, `stitches/`, `storage/`, `export/`, `canvas/`, `platform.ts`) together with its tests; the root `src/` and `ios/Web/src/` entrypoints re-export it and keep only the differences listed in `ios/docs/WEB_SYNC.md`. Browser tests live in `tests/e2e/`; static SEO and domain files are in `public/`.

## Build, Test, and Development Commands

Install pinned dependencies and start the development server:

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

This application is hosted by GitHub Pages and is publicly deployed at `https://knittingeditor.com/`. The `main` branch is the production source. A push to `main` triggers `.github/workflows/ci.yml`; Web or shared-code changes must pass the relevant Web and iOS jobs before the generated `dist/` artifact is deployed. iOS-only changes do not redeploy Pages. `public/CNAME` must remain `knittingeditor.com`, and Vite must continue to build for the site root (`base: '/'`).

Codex must treat the following as production requirements:

- Do not commit secrets, environment-specific credentials, or runtime server assumptions. The deployed application must remain a static site.
- Do not edit generated `dist/` files directly or commit them. Change source or `public/` assets and let the workflow build `dist/`.
- Do not change the custom domain, Pages workflow, deployment permissions, or production branch unless the user explicitly requests it.
- For routing, asset-path, service-worker, SEO, or domain changes, verify that direct access and reloads work under `https://knittingeditor.com/` and that all production URLs use HTTPS.

## Development Log

Codex must maintain the root `DEVELOPMENT_LOG.md` for every user-visible feature, bug fix, behavior change, migration, build/test configuration change, and deployment change, in both the Web and the iOS parts of this repository. It is the only active log; `ios/DEVELOPMENT_LOG.md` is a frozen archive of the app history from before the repositories were merged and must not receive new entries. Documentation-only edits with no runtime, test, or deployment impact may be omitted.

Add one concise entry per completed change, newest first, containing:

- the date (`YYYY-MM-DD`) and a short summary;
- the affected behavior and main files;
- tests added or updated and the exact verification commands run;
- deployment impact, including `none` when there is none, and any post-deployment check required.

Never claim a check passed unless it was actually run. If a required check cannot be run, record the reason in both the development log and the final response.

## Change-specific Test Requirements

Codex must add or update tests with each behavior change. Select checks based on the changed area, then run the full local suite before committing:

- Model, migration, storage, or export rules: add or update Vitest coverage with `npm test`.
- User workflows, persistence, gestures, responsive behavior, PNG/PDF output, or browser-facing regressions: add or update Playwright coverage and run `npm run test:e2e` in both configured Chromium and WebKit projects.
- UI or visual changes: manually inspect narrow/mobile and desktop viewports and save screenshots for the pull request; do not commit generated screenshots unless requested.
- Build, public assets, metadata, routes, CNAME, or deployment changes: run `npm run build` and `npm run check:dist`, then inspect `dist/` for the expected production paths and `CNAME`.
- Changes under `packages/` or `ios/`: run the iOS Web typecheck/tests, XcodeGen, Simulator tests, app-update test, unsigned Release Archive, and offline bundle inspection defined in `.github/workflows/ci.yml`.

The mandatory pre-commit suite is:

```sh
npm run typecheck
npm test
npm run build
npm run check:dist
npm run test:e2e
```

Targeted checks may be used during development, but they do not replace this suite. Codex must report which checks passed, failed, or were not run.

## Deployment Procedure

Codex must use the following production deployment procedure:

1. Confirm the worktree contains only intended changes, update `DEVELOPMENT_LOG.md` when required, and review the diff.
2. Run the complete pre-commit suite above and resolve every failure.
3. Commit focused changes according to the commit rules below. Do not deploy uncommitted work.
4. Push the reviewed commit to `main` only when the user has requested or approved deployment. Opening a pull request or pushing another branch runs validation but must not be described as a production deployment.
5. Confirm the `CI and deploy Pages` GitHub Actions workflow succeeded, including every job required by `ci-gate` and the `deploy` job. A successful local build or push alone is not proof of deployment.
6. Verify `https://knittingeditor.com/` over HTTPS after deployment. Exercise the changed user flow and confirm the expected assets, metadata, and custom domain. Record the result in `DEVELOPMENT_LOG.md`.

If GitHub Actions fails or the live site does not match the deployed commit, stop, report the exact failure, and fix or revert through a new focused commit. Never bypass the test job, deploy a locally modified `dist/`, force-push production history, or claim deployment success without checking both the workflow and live site.

## Coding Style & Naming Conventions

Use two-space indentation and strict TypeScript. Use `camelCase` for functions and variables, `PascalCase` for React components and classes, and kebab-case for CSS classes. Keep the board model independent from React and DOM APIs. Do not replace the packed typed-array model with per-cell objects or render individual cells as DOM nodes. Prefer explicit types, immutable React state, and small single-purpose functions.

## Testing Guidelines

Vitest covers board and export logic; Playwright covers Chromium/WebKit at mobile and desktop sizes. Put tests for shared code in `packages/editor-core` next to the module they cover — the root `npm test` picks them up — and keep only Web-specific tests in `src/`. Add unit tests for model rules and E2E tests for user workflows. Verify grid resizing, gestures, block copy/paste, persistence, migration, backup, PNG, and PDF behavior. For visual changes, check narrow and desktop widths and include screenshots in the pull request.

## Commit & Pull Request Guidelines

Keep each commit focused on one purpose; separate formatting-only changes. Recent history uses short imperative summaries. Prefer Conventional Commit prefixes such as `feat: add cable stitch` or `fix: preserve grid after resize`. Pull requests should explain the user-visible change, list manual checks, link related issues, and include screenshots for UI or stitch-symbol changes. Avoid committing generated PNG/PDF files or local `.DS_Store` files.
