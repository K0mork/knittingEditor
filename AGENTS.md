# Repository Guidelines

## Project Structure & Module Organization

This repository is a dependency-light, static knitting-chart editor. `index.html` defines the page structure and loads the application as ES modules. JavaScript lives in `js/`: `main.js` wires UI events, `gridManager.js` owns grid state and rendering, `stitchSymbols.js` contains SVG stitch definitions, `storage.js` handles browser persistence, and `prompt.js` implements numeric dialogs. Styling is split between base layout in `css/styles.css` and visual overrides in `css/theme.css`. Jekyll/GitHub Pages configuration is in `_config.yml`; `CNAME` defines the production domain.

## Build, Test, and Development Commands

No package installation or compile step is required. Run a local HTTP server from the repository root:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Do not open `index.html` directly, because browser restrictions around ES modules can differ under `file://`. Before committing JavaScript, check its syntax:

```sh
for file in js/*.js; do node --check "$file"; done
```

## Coding Style & Naming Conventions

Use two-space indentation in HTML and CSS. Follow the surrounding JavaScript style when editing a file; newer modules use two spaces, while `gridManager.js` and `storage.js` retain four-space indentation. Use `camelCase` for functions and variables, `PascalCase` for classes, and kebab-case for HTML IDs and CSS classes. Keep DOM wiring in `main.js`, grid behavior in `GridManager`, and reusable stitch SVGs in `stitchSymbols.js`. Prefer `const`, explicit module imports, and small single-purpose functions.

## Testing Guidelines

There is currently no automated test suite or coverage threshold. Perform manual regression testing in both mouse and touch-sized layouts. Verify grid resizing, row/column insertion and deletion, stitch and color selection, clear, PNG export, and state restoration after reload. For visual changes, check narrow and desktop widths and include before/after screenshots in the pull request.

## Commit & Pull Request Guidelines

Keep each commit focused on one purpose; separate formatting-only changes. Recent history uses short imperative summaries. Prefer Conventional Commit prefixes such as `feat: add cable stitch` or `fix: preserve grid after resize`. Pull requests should explain the user-visible change, list manual checks, link related issues, and include screenshots for UI or stitch-symbol changes. Avoid committing generated PNG/PDF files or local `.DS_Store` files.
