# Carnatic Music Notation Typesetter 3.0

Typeset Carnatic music notation (swaras, lyrics, tala markers, speed lines, gamakas) in English, English with diacritics, Sanskrit, Telugu, Kannada, Malayalam and Tamil, and **read handwritten notation from a photo**. It runs as a website and as a desktop app for Windows, macOS and Linux.

> **Credit:** the Carnatic Music Notation Typesetter and its input format were created by **Arun K** ([original project](https://sourceforge.net/projects/cmnt/), [his page about it](http://arunk.freepgs.com/wordpress/cm-typesetter/about/)). This is an **unofficial, community-maintained rebuild** of his v1.5 Beta, made because the original site is no longer maintained. It is not affiliated with or endorsed by Arun K. See [NOTICE.md](NOTICE.md) for full credits and the list of changes.

**Live site:** https://carnatic-notation-typesetter.onrender.com

It reads the **same input format** as the original, so notation files written for the old site open unchanged.

- **Built with** React and TypeScript (Vite), with a framework-independent, fully typed notation engine.
- **Design** follows Apple's Human Interface Guidelines: a unified title bar and toolbar, text and notation side by side, light and dark mode, sheets for dialogs, and a phone layout that switches between Notation and Text.
- **Read Photo** turns a photo or scan of handwritten or printed notation (English letters, Tamil, Telugu, Kannada, Malayalam or Devanagari) into editable input, using Claude's vision with the user's own Anthropic API key.
- **Manual:** `docs/manual.html`, with live rendered examples.

## Project layout

```
index.html               editor page (Vite entry)
docs/manual.html         manual page (Vite entry); examples rendered by src/manual.ts
src/
  engine/                the notation engine (no React; usable on its own)
    types.ts             document model
    parser.ts            reads the input (v1.5 syntax + extensions)
    layout.ts            breaks notation into rows against the tala
    render.ts            draws the page: measures text, aligns columns, scales to fit
    talas.ts             all 35 suladi talas, capu talas, Adi variants
    translit.ts          Unified Transliteration Scheme -> IAST / Devanagari / Telugu / Kannada / Malayalam / Tamil
    heading.ts           Heading directive: attributes and Wiky-style formatting
    examples.ts          the Examples menu
  app/App.tsx            the editor: layout, commands, files, autosave, desktop bridge
  components/            title bar toolbar, editor, preview, splitter, issues badge, modal, toast
  dialogs/               New song, Assist, Examples, Share, Read Photo, Settings, confirm
  recognition/           Read Photo: prompt, Anthropic API call, image preparation, settings
  lib/                   alignment, TAB completion, share links, storage, desktop bridge types
  styles/                notation.css (the page), app.css (the editor), fonts.css
  assets/fonts/          bundled fonts, three styles per language: Noto Serif, Anek (sans), Nunito + Baloo (rounded); SIL OFL
desktop/                 Electron main process and preload (desktop app)
build/                   app icon
tests/                   Vitest tests (engine, Read Photo with a simulated API, Align/TAB)
Dockerfile, deploy/      web container (nginx); render.yaml deploys it on Render
.github/workflows/       pages.yml -> GitHub Pages; desktop.yml -> Windows/Mac/Linux installers
```

## Developing

Needs Node.js 20 or newer.

```
npm install
npm run dev          # editor at http://localhost:5173 with live reload
npm test             # 33 tests
npm run typecheck    # TypeScript
npm run build        # production website into dist/
npm run preview      # serve dist/ locally
npm run app          # build and run the desktop app
```

## Publishing the website

The site is a static build in `dist/`.

- **Render (set up):** `render.yaml` is a Blueprint for a free **static site** on Render's CDN: always on, no cold starts, rebuilt (tests included) on every push to `main`. On [render.com](https://render.com), choose **New → Blueprint** and pick this repository.
- **Docker anywhere** (the site in an nginx container, for hosts that run containers): `docker build -t cmnt .` then `docker run --rm -p 8080:10000 cmnt`, and open http://localhost:8080. The container listens on `$PORT` (default 10000) and answers `/healthz` for health checks.
- **GitHub Pages:** go to **Settings → Pages**, set **Source** to **GitHub Actions**, then run **Actions → Website → Run workflow** (`.github/workflows/pages.yml`).
- **Netlify / Cloudflare Pages:** build command `npm run build`, output directory `dist`.
- **Any other host (e.g. freepgs):** run `npm run build` and upload the contents of `dist/`. To keep the old address working, upload into `cmntv15b/cmnt/` and add a `newsong.html` containing `<meta http-equiv="refresh" content="0; url=index.html">`.

The build uses relative paths, so it works in any folder.

## Song library

Songs are kept in the browser's local storage (`src/lib/library.ts`) and saved as you type; the Library window (`src/dialogs/LibraryDialog.tsx`) searches, opens, duplicates, deletes (with Undo), imports files, and backs up / restores everything as one JSON file. The single draft kept by earlier versions moves into the library on first start.

## Install and offline

On the website the typesetter is an installable web app: Chrome and Edge show an **Install** button, iPhone/iPad use **Share → Add to Home Screen**. A service worker (`src/sw-template.js`, filled in by `vite.config.ts` at build time) keeps the app and its default fonts on the device, so it works offline; the optional Sans/Rounded fonts are cached when first used. Pages are fetched network-first, so a new deploy shows up on the next visit.

## Desktop app

The same editor in a native window ([Electron](https://www.electronjs.org/)), plus:

- **Real files:** Open, Save and Save As, plus Open Recent. Files save as `.cmnt` (plain text, so old `.txt` files open too). Double-clicking a `.cmnt` file opens it, and you can drag a file onto the window.
- **PDF and printing:** Export PDF (⌘/Ctrl+E) and native Print (⌘/Ctrl+P).
- **Menus** with keyboard shortcuts, and several windows at once. On macOS the toolbar is the title bar, with the traffic lights inset.
- **Safety:** a "Save changes?" prompt when closing, and crash recovery (unsaved work comes back after a crash).
- **Secure key storage:** the Read Photo API key is encrypted by the operating system (Keychain on macOS, Data Protection on Windows).

**Getting installers:** in the GitHub repository, open **Actions → Desktop apps → Run workflow**. After about 10 minutes the run page has a Windows installer and portable `.exe`, Mac `.dmg` files (Apple Silicon and Intel), and Linux `.AppImage`/`.deb` files. Pushing a tag such as `v3.0.1` also publishes them as a GitHub Release. Bump `"version"` in `package.json` first.

**Unsigned builds:** the apps aren't code-signed (that needs paid certificates), so the first launch shows a warning. On Windows, click **More info → Run anyway**. On macOS, try to open the app, then go to **System Settings → Privacy & Security → Open Anyway**. Adding certificates as repository secrets (listed at the top of `desktop.yml`) makes the workflow sign and notarise automatically.

Build locally with `npm run dist:win`, `npm run dist:mac` (on a Mac only) or `npm run dist:linux`; output goes to `release/`.

## Read Photo (handwriting recognition)

How it works:

1. The photos are rotated if needed, scaled to at most 2,576 px on the long edge and sent to the Anthropic Messages API with instructions describing this input format (`src/recognition/prompt.ts`).
2. The reply is checked with the typesetter's own parser. If it has problems, the model is asked once to correct them.
3. The user reviews the text next to the photo and a live preview, then inserts it.

- **API key:** each user supplies their own. Without one, nothing is sent anywhere.
- **Models:** Claude Sonnet 5.5 (default), Opus 5.5 (most accurate) and Haiku 5.5 (cheapest).
- **Cost:** a page costs a few US cents with Sonnet.
- **Where the code is:** the API call is in `src/recognition/claude.ts`. The website's Content-Security-Policy allows connections only to `api.anthropic.com`.
- **Improving accuracy:** edit `SYSTEM_PROMPT` in `prompt.ts`. The tests check that its worked example is valid input.

## Maintaining it

- **Add an example:** append `{ id, title, text }` to `src/engine/examples.ts`. The tests check that it parses cleanly.
- **Add or swap a font style:** add the `@font-face` rules in `src/styles/fonts.css` (files in `src/assets/fonts`), then list the families in `src/engine/fonts.ts`.
- **Change the page's look:** edit `src/styles/notation.css`. The horizontal spacing values are in `SP` in `src/engine/render.ts`.
- **Change the editor's look:** edit `src/styles/app.css`. Colours are semantic variables at the top, with dark-mode values below them.
- **Add a tala:** edit `SPECIAL` / `SPECIAL_ALIASES` in `src/engine/talas.ts`.
- **Add a directive:** add a `case` in `parse()` in `src/engine/parser.ts`, document it in `docs/manual.html`, and add it to `DIRECTIVES` in `src/lib/directives.ts` (for Assist and TAB completion).
- **Desktop behaviour:** edit `desktop/main.cjs`. The page talks to it only through `desktop/preload.cjs` (typed in `src/lib/desktop.ts`).
- **Updates:** update dependencies now and then (`npm outdated`, then `npm update`), and Electron in particular for security fixes. Run `npm test` and `npm run app` afterwards.

## Credits and licence

The original typesetter, its input format and the v1.5 Beta manual were created by **Arun K** and released under the GNU GPL v2 (https://sourceforge.net/projects/cmnt/). This rebuild's code was written from scratch to the same specification; it is free software under the same licence, the **GNU General Public License, version 2** (see `LICENSE`). Full credits and the list of changes are in [NOTICE.md](NOTICE.md). The bundled fonts (Noto Serif, Anek, Nunito and the Baloo 2 family) are under the SIL Open Font License 1.1 (`src/assets/fonts/OFL.txt`).
