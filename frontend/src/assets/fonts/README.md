# Fonts (local only)

The font binaries in this folder are **not committed** to the repository (see
`.gitignore`). They are third-party/proprietary files that must not be
redistributed.

Only **Product Sans** is referenced by the app, via `@font-face` in
`frontend/src/index.css`:

| File | Used for |
|------|----------|
| `Product Sans Regular.otf` | `--font-sans` (body/UI) |
| `Product Sans Italic.otf` | body/UI italic |
| `Product Sans Bold.otf` | body/UI bold |
| `Product Sans Bold Italic.otf` | body/UI bold italic |

Headings use **Playfair Display**, which is installed from npm
(`@fontsource-variable/playfair-display`) and therefore needs no local file.

## What happens without these files

The `@font-face` sources simply fail to resolve and the UI falls back to
`system-ui` (see the `--font-sans` stack in `frontend/src/index.css`). The app
builds and runs fine — it just uses the system font instead of Product Sans.

## Adding the fonts locally (optional)

Product Sans is proprietary (Google) and is not distributed here. If you own a
license/copy, drop the four `.otf` files listed above into this folder and the
UI will pick them up automatically. These files will stay untracked because the
whole folder is git-ignored.
