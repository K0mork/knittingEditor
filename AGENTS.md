# Repository Guidelines

## Project Structure & Module Organization

This repository is a Vite/React knitting-chart editor deployed as a static GitHub Pages site. Application code lives in `src/`: `model/` owns the packed board representation, `canvas/` renders and handles gestures, `storage/` manages IndexedDB and backups, `export/` creates PNG/PDF files, and `stitches/` defines symbols. Browser tests live in `tests/e2e/`; static SEO and domain files are in `public/`.

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

## Coding Style & Naming Conventions

Use two-space indentation and strict TypeScript. Use `camelCase` for functions and variables, `PascalCase` for React components and classes, and kebab-case for CSS classes. Keep the board model independent from React and DOM APIs. Do not replace the packed typed-array model with per-cell objects or render individual cells as DOM nodes. Prefer explicit types, immutable React state, and small single-purpose functions.

## Testing Guidelines

Vitest covers board and export logic; Playwright covers Chromium/WebKit at mobile and desktop sizes. Add unit tests for model rules and E2E tests for user workflows. Verify grid resizing, gestures, block copy/paste, persistence, migration, backup, PNG, and PDF behavior. For visual changes, check narrow and desktop widths and include screenshots in the pull request.

## Commit & Pull Request Guidelines

Keep each commit focused on one purpose; separate formatting-only changes. Recent history uses short imperative summaries. Prefer Conventional Commit prefixes such as `feat: add cable stitch` or `fix: preserve grid after resize`. Pull requests should explain the user-visible change, list manual checks, link related issues, and include screenshots for UI or stitch-symbol changes. Avoid committing generated PNG/PDF files or local `.DS_Store` files.
